import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, where, writeBatch, type Query,
} from 'firebase/firestore';
import { db } from '@/data/firebase';
import { logActivity } from '@/data/activityLog';
import { commentedText, createdText, deletedText, statusChangeText, type ActivityType } from '@/domain/activity';
import { playTaskDone } from '@/lib/sound';
import { blankNote } from '@/domain/work/notes';
import { blankTask, moveToStatus, nextTaskNo } from '@/domain/work/tasks';
import { adminProjectOf, assignableIn, canEditAsGuest, isAdminOf, isInProject, normalizeProject, normalizeTask, OWNER_KEY, staleViewers, viewersOf } from '@/domain/work/sharing';
import type { Note, Project, ProjectPrivate, Task, TaskComment, TaskStatus } from '@/domain/work/types';

/**
 * Projects, tasks and comments, kept live from Firestore. Each kind is its own collection (a task or a project is a
 * document, not a row in one big value), so edits don't overwrite each other and there is room to grow.
 * `WorkProvider` listens once; every work screen reads from `useWork()`.
 *
 * Hamed reads all of it. A guest's queries ask only for what is theirs — the projects they are a member of and the tasks
 * that list them as a viewer — which is also exactly what firestore.rules lets them read.
 */
const PROJECTS = 'work_projects';
const PRIVATES = 'work_projects_private';
const TASKS = 'work_tasks';
const NOTES = 'work_notes';

/** Firestore refuses `undefined`; a field that is not there is simply left out. */
const clean = <T extends object>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The fields a guest may change on a task (firestore.rules allows exactly these). */
const GUEST_TASK_FIELDS = ['title', 'status', 'priority', 'date', 'endDate', 'description', 'tags', 'doneAt', 'updatedAt'] as const;
/** What a project's admin may change on a task of that project: the same, and who it is for (with who may then see it, and who changed it). */
const ADMIN_TASK_FIELDS = [...GUEST_TASK_FIELDS, 'assignee', 'assigneeUid', 'assigneeUids', 'viewerUids', 'updatedByUid'] as const;
/** What a project's admin may change on the project itself (never who is on it). */
const ADMIN_PROJECT_FIELDS = ['name', 'status', 'priority', 'date', 'endDate', 'updatedAt'] as const;

export type WorkScope = { kind: 'owner' } | { kind: 'guest'; uid: string; name: string };
export type NewTask = Partial<Omit<Task, 'id' | 'no'>> & { title: string };
export type NewProject = Partial<Omit<Project, 'id'>> & { name: string };

interface WorkContextType {
  role: WorkScope['kind'];
  /** A guest's own uid (null for Hamed). */
  guestUid: string | null;
  /** How this person stands in a task's `assigneeUids`: `OWNER_KEY` for Hamed, the uid for a guest. */
  me: string;
  projects: Project[];
  tasks: Task[];
  /** Who each project is for — Hamed's only. */
  privates: Record<string, ProjectPrivate>;
  /** Notes — Hamed's only (a guest gets none). */
  notes: Note[];
  /** The first answer from Firestore has arrived (before it, lists are empty rather than missing). */
  ready: boolean;
  /** May this person change this task? Hamed any; a guest the ones that are theirs, and any of a project they run. */
  canEditTask: (task: Task) => boolean;
  /** May this person delete it? Hamed any; a guest the ones they made, and any of a project they run. */
  canDeleteTask: (task: Task) => boolean;
  /** Does this guest run the project (are they one of its admins)? Always false for Hamed's own screens — he can do everything. */
  isProjectAdmin: (projectId: string | null | undefined) => boolean;
  addTask: (input: NewTask) => Promise<string>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<void>;
  /** Moves a task to a status (when the person may change it), stamping when it was finished or reopened. */
  setTaskStatus: (task: Task, status: TaskStatus) => Promise<void>;
  /** The tick: finishes an open task, reopens a finished one. */
  toggleTaskDone: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  addProject: (input: NewProject, client?: string | null) => Promise<string>;
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => Promise<void>;
  /** Who is on a project, and whether they see every task of it: also brings each task's viewers up to date. */
  setSharing: (projectId: string, memberUids: string[], guestsSeeAll: boolean, adminUids?: string[], memberProfiles?: Project['memberProfiles']) => Promise<void>;
  setClient: (projectId: string, client: string | null) => Promise<void>;
  /** Removes the project and its client record; its tasks stay, with no project. */
  removeProject: (id: string) => Promise<void>;
  addNote: (projectId?: string | null) => Promise<string>;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'markdown' | 'projectId'>>) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
}

const WorkContext = createContext<WorkContextType | null>(null);

export const WorkProvider: React.FC<{ scope: WorkScope; children: React.ReactNode }> = ({ scope, children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privates, setPrivates] = useState<Record<string, ProjectPrivate>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [answered, setAnswered] = useState({ projects: false, tasks: false });
  // The mutations below read the latest data without being rebuilt every time it changes.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const uid = scope.kind === 'guest' ? scope.uid : null;
  const guestName = scope.kind === 'guest' ? scope.name : null;
  /** A guest's own actions are written to the log Hamed reads; Hamed's are not. */
  const note = useCallback((type: ActivityType, text: string, taskId?: string) => {
    if (uid) void logActivity({ uid, name: guestName ?? 'Guest', type, text, taskId });
  }, [uid, guestName]);

  useEffect(() => {
    const fail = (name: string) => (error: Error) => console.warn(`Could not listen to ${name}:`, error.message);
    const mine = (name: string, field: string): Query => (uid ? query(collection(db, name), where(field, 'array-contains', uid)) : collection(db, name));
    const stops = [
      onSnapshot(mine(PROJECTS, 'memberUids'), (snap) => {
        setProjects(snap.docs.map((d) => normalizeProject({ ...(d.data() as Partial<Project>), id: d.id })));
        setAnswered((a) => ({ ...a, projects: true }));
      }, fail(PROJECTS)),
      onSnapshot(mine(TASKS, 'viewerUids'), (snap) => {
        setTasks(snap.docs.map((d) => normalizeTask({ ...(d.data() as Partial<Task>), id: d.id })));
        setAnswered((a) => ({ ...a, tasks: true }));
      }, fail(TASKS)),
    ];
    // Who each project is for, and the notes, are Hamed's alone.
    if (!uid) {
      stops.push(onSnapshot(collection(db, NOTES), (snap) => {
        setNotes(snap.docs.map((d) => ({ title: '', markdown: '', projectId: null, createdAt: '', updatedAt: '', ...(d.data() as Partial<Note>), id: d.id })));
      }, fail(NOTES)));
      stops.push(onSnapshot(collection(db, PRIVATES), (snap) => {
        setPrivates(Object.fromEntries(snap.docs.map((d) => [d.id, { ...(d.data() as Omit<ProjectPrivate, 'id'>), id: d.id }])));
      }, fail(PRIVATES)));
    }
    return () => stops.forEach((stop) => stop());
  }, [uid]);

  /** The sharing of each of the projects a task is in (the ones that exist), for working out who may see it. */
  const projectsOf = (ids: readonly string[]) => ids.map((id) => projectsRef.current.find((p) => p.id === id)).filter((p): p is Project => !!p);

  const canEditTask = useCallback((task: Task) => !uid || canEditAsGuest(task, uid, projectsRef.current), [uid]);
  const canDeleteTask = useCallback((task: Task) => !uid || task.createdByUid === uid || adminProjectOf(task, projectsRef.current, uid) !== null, [uid]);
  const isProjectAdmin = useCallback((projectId: string | null | undefined) => !!uid && !!projectId && isAdminOf(projectsRef.current.find((p) => p.id === projectId), uid), [uid]);

  const addTask = useCallback(async (input: NewTask) => {
    const ref = doc(collection(db, TASKS));
    const { title, ...rest } = input;
    // The project a guest is making a task in, if they run it: there they may give the task to any member.
    const wantedProject = rest.projectIds?.[0] ?? rest.projectId ?? null;
    const run = uid && wantedProject ? projectsRef.current.find((p) => p.id === wantedProject && isAdminOf(p, uid)) : undefined;
    if (uid && run) {
      const allowed = new Set(assignableIn(run));
      const wanted = (rest.assigneeUids ?? []).filter((who) => allowed.has(who));
      const assigneeUids = wanted.length ? wanted : [uid];
      const first = assigneeUids[0];
      const base = blankTask(0, run.id);
      const body = {
        ...base, ...rest, title, no: 0, projectId: run.id, createdByUid: uid, updatedByUid: uid,
        assigneeUids, assigneeUid: first === OWNER_KEY ? null : first, assignee: rest.assignee ?? guestName,
        viewerUids: viewersOf({ assigneeUids, createdByUid: uid }, [run]),
      };
      // The rules know no `projectIds` on a guest's task, nor an end date that is not set.
      const { projectIds: _ids, endDate, ...others } = body;
      await setDoc(ref, clean({ ...others, ...(endDate ? { endDate } : {}) }));
      note('task_created', createdText(title), ref.id);
      return ref.id;
    }
    // A guest's task is for themself, made by themself, and numbered 0 (the numbers are Hamed's running count).
    const mine = uid ? { no: 0, createdByUid: uid, assigneeUid: uid, assigneeUids: [uid], assignee: guestName } : {};
    const base = { ...blankTask(nextTaskNo(tasksRef.current), null), ...rest, ...mine, title };
    // A task keeps its first project as `projectId` (older code reads that) and all of them in `projectIds`.
    const projectIds = base.projectIds.length ? base.projectIds : base.projectId ? [base.projectId] : [];
    const withProjects = { ...base, projectIds, projectId: projectIds[0] ?? null };
    const viewerUids = viewersOf(withProjects, projectsOf(projectIds));
    // A guest's task is in one project at most, and has no end date unless they set one: the rules know no other fields.
    const body = uid
      ? (({ projectIds: _ids, assigneeUids: _who, endDate, ...others }) => ({ ...others, ...(endDate ? { endDate } : {}) }))(withProjects)
      : withProjects;
    await setDoc(ref, clean({ ...body, viewerUids }));
    note('task_created', createdText(title), ref.id);
    return ref.id;
  }, [uid, guestName, note]);

  const updateTask = useCallback(async (id: string, patch: Partial<Omit<Task, 'id'>>) => {
    const stamped = { ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() };
    // The one place every way of finishing a task passes through (the tick, a drag to Done, the editor, the Home card).
    if (stamped.status === 'done' && tasksRef.current.find((t) => t.id === id)?.status !== 'done') playTaskDone();
    if (uid) {
      // A guest changes only what firestore.rules lets them.
      const current = tasksRef.current.find((t) => t.id === id);
      const run = current ? adminProjectOf(current, projectsRef.current, uid) : null;
      // A project's admin may also change who a task is for (among the members and Hamed), and then who sees it.
      let fields: Partial<Task> = stamped;
      if (run && current) {
        fields = { ...stamped, updatedByUid: uid };
        if (stamped.assigneeUids) {
          const allowed = new Set(assignableIn(run));
          const assigneeUids = stamped.assigneeUids.filter((who) => allowed.has(who));
          const next = assigneeUids.length ? assigneeUids : current.assigneeUids;
          const first = next[0];
          fields = { ...fields, assigneeUids: next, assigneeUid: first === OWNER_KEY ? null : first, viewerUids: viewersOf({ assigneeUids: next, createdByUid: current.createdByUid }, [run]) };
        }
      }
      // An end date goes in only when it is set (or being cleared): sending an empty one would add a field the rules don't expect.
      const names: readonly string[] = run ? ADMIN_TASK_FIELDS : GUEST_TASK_FIELDS;
      const allowed = Object.fromEntries(Object.entries(fields)
        .filter(([k]) => names.includes(k) && (k !== 'endDate' || stamped.endDate || current?.endDate)));
      await setDoc(doc(db, TASKS, id), clean(allowed), { merge: true });
      if (current && stamped.status && stamped.status !== current.status) note('task_status', statusChangeText(current.title, current.status, stamped.status), id);
      return;
    }
    // Hamed moving a task to another project, or to someone else, changes who may see it.
    const current = tasksRef.current.find((t) => t.id === id);
    let next = current ? { ...current, ...stamped } : null;
    // Changing the projects keeps `projectId` as the first of them.
    if (next && 'projectIds' in stamped) {
      const ids = stamped.projectIds ?? [];
      next = { ...next, projectIds: ids, projectId: ids[0] ?? null };
    }
    const withViewers = next && ('projectIds' in stamped || 'projectId' in stamped || 'assigneeUid' in stamped || 'assigneeUids' in stamped)
      ? { ...stamped, projectIds: next.projectIds, projectId: next.projectId, viewerUids: viewersOf(next, projectsOf(next.projectIds)) }
      : stamped;
    // Hamed's own change: an earlier change by a project's admin must not be taken for this one.
    await setDoc(doc(db, TASKS, id), clean({ ...withViewers, updatedByUid: null }), { merge: true });
  }, [uid, note]);

  const setTaskStatus = useCallback(async (task: Task, status: TaskStatus) => {
    if (canEditTask(task)) await updateTask(task.id, moveToStatus(task, status));
  }, [canEditTask, updateTask]);

  const toggleTaskDone = useCallback((task: Task) => setTaskStatus(task, task.status === 'done' ? 'todo' : 'done'), [setTaskStatus]);

  const removeTask = useCallback(async (id: string) => {
    const gone = tasksRef.current.find((t) => t.id === id);
    await deleteDoc(doc(db, TASKS, id));
    if (gone) note('task_deleted', deletedText(gone.title), id);
  }, [note]);

  const addProject = useCallback(async (input: NewProject, client: string | null = null) => {
    const ref = doc(collection(db, PROJECTS));
    const at = new Date().toISOString();
    const project: Omit<Project, 'id'> = {
      status: 'active', priority: null, lead: null, date: null, endDate: null, memberUids: [], guestsSeeAll: false, adminUids: [], memberProfiles: {}, createdAt: at, updatedAt: at, ...input,
    };
    await setDoc(ref, clean(project));
    if (client) await setDoc(doc(db, PRIVATES, ref.id), { client });
    return ref.id;
  }, []);

  const updateProject = useCallback(async (id: string, patch: Partial<Omit<Project, 'id'>>) => {
    const stamped = { ...patch, updatedAt: new Date().toISOString() };
    // A project's admin changes only what firestore.rules lets them: its name, status, priority and dates.
    const body = uid ? Object.fromEntries(Object.entries(stamped).filter(([k]) => (ADMIN_PROJECT_FIELDS as readonly string[]).includes(k))) : stamped;
    await setDoc(doc(db, PROJECTS, id), clean(body), { merge: true });
  }, [uid]);

  const setSharing = useCallback(async (projectId: string, memberUids: string[], guestsSeeAll: boolean, requestedAdmins: string[] = [], memberProfiles: Project['memberProfiles'] = {}) => {
    const batch = writeBatch(db);
    // An admin is a member; a name is kept only for someone who is on the project (and for Hamed).
    const adminUids = requestedAdmins.filter((who) => memberUids.includes(who));
    const profiles = Object.fromEntries(Object.entries(memberProfiles).filter(([who]) => who === OWNER_KEY || memberUids.includes(who)));
    batch.set(doc(db, PROJECTS, projectId), { memberUids, guestsSeeAll, adminUids, memberProfiles: profiles, updatedAt: new Date().toISOString() }, { merge: true });
    const inProject = tasksRef.current.filter((t) => isInProject(t, projectId));
    const sharingOf = (id: string) => projectsRef.current.find((p) => p.id === id) ?? null;
    for (const { id, viewerUids } of staleViewers(inProject, { id: projectId, memberUids, guestsSeeAll, adminUids }, sharingOf)) {
      batch.set(doc(db, TASKS, id), { viewerUids }, { merge: true });
    }
    await batch.commit();
  }, []);

  const setClient = useCallback(async (projectId: string, client: string | null) => {
    if (client?.trim()) await setDoc(doc(db, PRIVATES, projectId), { client: client.trim() });
    else await deleteDoc(doc(db, PRIVATES, projectId));
  }, []);

  const removeProject = useCallback(async (id: string) => {
    const batch = writeBatch(db);
    for (const task of tasksRef.current) {
      if (!isInProject(task, id)) continue;
      const projectIds = task.projectIds.filter((p) => p !== id);
      batch.set(doc(db, TASKS, task.id), {
        projectIds, projectId: projectIds[0] ?? null, viewerUids: viewersOf(task, projectsOf(projectIds)), updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    batch.delete(doc(db, PROJECTS, id));
    batch.delete(doc(db, PRIVATES, id));
    await batch.commit();
  }, []);

  const addNote = useCallback(async (projectId: string | null = null) => {
    const ref = doc(collection(db, NOTES));
    await setDoc(ref, blankNote(projectId));
    return ref.id;
  }, []);

  const updateNote = useCallback(async (id: string, patch: Partial<Pick<Note, 'title' | 'markdown' | 'projectId'>>) => {
    await setDoc(doc(db, NOTES, id), clean({ ...patch, updatedAt: new Date().toISOString() }), { merge: true });
  }, []);

  const removeNote = useCallback(async (id: string) => {
    await deleteDoc(doc(db, NOTES, id));
  }, []);

  const value = useMemo<WorkContextType>(() => ({
    role: scope.kind, guestUid: uid, me: uid ?? OWNER_KEY, projects, tasks, privates, notes, ready: answered.projects && answered.tasks, canEditTask, canDeleteTask, isProjectAdmin,
    addTask, updateTask, setTaskStatus, toggleTaskDone, removeTask, addProject, updateProject, setSharing, setClient, removeProject, addNote, updateNote, removeNote,
  }), [scope.kind, uid, projects, tasks, privates, notes, answered, canEditTask, canDeleteTask, isProjectAdmin, addTask, updateTask, setTaskStatus, toggleTaskDone, removeTask, addProject, updateProject, setSharing, setClient, removeProject, addNote, updateNote, removeNote]);

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
};

/** The work data if a provider is above, else null — for screens that also show to someone who has none. */
export function useWorkOptional(): WorkContextType | null {
  return useContext(WorkContext);
}

export function useWork(): WorkContextType {
  const ctx = useContext(WorkContext);
  if (!ctx) throw new Error('useWork must be used inside a WorkProvider');
  return ctx;
}

/** A task's comments, oldest first, kept live while its editor is open. */
export function useComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([]);

  useEffect(() => {
    if (!taskId) { setComments([]); return; }
    return onSnapshot(
      query(collection(db, TASKS, taskId, 'comments'), orderBy('at')),
      (snap) => setComments(snap.docs.map((d) => ({ ...(d.data() as Omit<TaskComment, 'id'>), id: d.id }))),
      (error) => console.warn('Could not listen to comments:', error.message),
    );
  }, [taskId]);

  /** `authorUid` is a guest's own uid (the rules require it of a guest); Hamed's comments have none. */
  const add = useCallback(async (author: string, text: string, authorUid?: string, taskTitle = '') => {
    if (!taskId || !text.trim()) return;
    await setDoc(doc(collection(db, TASKS, taskId, 'comments')), {
      author, text: text.trim(), at: new Date().toISOString(), ...(authorUid ? { authorUid } : {}),
    });
    if (authorUid) void logActivity({ uid: authorUid, name: author, type: 'comment', text: commentedText(taskTitle), taskId });
  }, [taskId]);

  const remove = useCallback(async (id: string) => {
    if (taskId) await deleteDoc(doc(db, TASKS, taskId, 'comments', id));
  }, [taskId]);

  return { comments, add, remove };
}

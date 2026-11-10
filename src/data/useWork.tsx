import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, where, writeBatch, type Query,
} from 'firebase/firestore';
import { db } from '@/data/firebase';
import { playTaskDone } from '@/lib/sound';
import { blankNote } from '@/domain/work/notes';
import { blankTask, nextTaskNo } from '@/domain/work/tasks';
import { isInProject, isMineAsGuest, normalizeProject, normalizeTask, OWNER_KEY, staleViewers, viewersOf } from '@/domain/work/sharing';
import type { Note, Project, ProjectPrivate, Task, TaskComment } from '@/domain/work/types';

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
  /** May this person change this task? Hamed any; a guest the ones that are theirs. */
  canEditTask: (task: Task) => boolean;
  addTask: (input: NewTask) => Promise<string>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  addProject: (input: NewProject, client?: string | null) => Promise<string>;
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => Promise<void>;
  /** Who is on a project, and whether they see every task of it: also brings each task's viewers up to date. */
  setSharing: (projectId: string, memberUids: string[], guestsSeeAll: boolean) => Promise<void>;
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

  const canEditTask = useCallback((task: Task) => !uid || isMineAsGuest(task, uid), [uid]);

  const addTask = useCallback(async (input: NewTask) => {
    const ref = doc(collection(db, TASKS));
    const { title, ...rest } = input;
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
    return ref.id;
  }, [uid, guestName]);

  const updateTask = useCallback(async (id: string, patch: Partial<Omit<Task, 'id'>>) => {
    const stamped = { ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() };
    // The one place every way of finishing a task passes through (the tick, a drag to Done, the editor, the Home card).
    if (stamped.status === 'done' && tasksRef.current.find((t) => t.id === id)?.status !== 'done') playTaskDone();
    if (uid) {
      // A guest changes only what firestore.rules lets them.
      const current = tasksRef.current.find((t) => t.id === id);
      // An end date goes in only when it is set (or being cleared): sending an empty one would add a field the rules don't expect.
      const allowed = Object.fromEntries(GUEST_TASK_FIELDS
        .filter((k) => k in stamped && (k !== 'endDate' || stamped.endDate || current?.endDate))
        .map((k) => [k, stamped[k]]));
      await setDoc(doc(db, TASKS, id), clean(allowed), { merge: true });
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
    await setDoc(doc(db, TASKS, id), clean(withViewers), { merge: true });
  }, [uid]);

  const removeTask = useCallback(async (id: string) => {
    await deleteDoc(doc(db, TASKS, id));
  }, []);

  const addProject = useCallback(async (input: NewProject, client: string | null = null) => {
    const ref = doc(collection(db, PROJECTS));
    const at = new Date().toISOString();
    const project: Omit<Project, 'id'> = {
      status: 'active', priority: null, lead: null, date: null, endDate: null, memberUids: [], guestsSeeAll: false, createdAt: at, updatedAt: at, ...input,
    };
    await setDoc(ref, clean(project));
    if (client) await setDoc(doc(db, PRIVATES, ref.id), { client });
    return ref.id;
  }, []);

  const updateProject = useCallback(async (id: string, patch: Partial<Omit<Project, 'id'>>) => {
    await setDoc(doc(db, PROJECTS, id), clean({ ...patch, updatedAt: new Date().toISOString() }), { merge: true });
  }, []);

  const setSharing = useCallback(async (projectId: string, memberUids: string[], guestsSeeAll: boolean) => {
    const batch = writeBatch(db);
    batch.set(doc(db, PROJECTS, projectId), { memberUids, guestsSeeAll, updatedAt: new Date().toISOString() }, { merge: true });
    const inProject = tasksRef.current.filter((t) => isInProject(t, projectId));
    const sharingOf = (id: string) => projectsRef.current.find((p) => p.id === id) ?? null;
    for (const { id, viewerUids } of staleViewers(inProject, { id: projectId, memberUids, guestsSeeAll }, sharingOf)) {
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
    role: scope.kind, guestUid: uid, me: uid ?? OWNER_KEY, projects, tasks, privates, notes, ready: answered.projects && answered.tasks, canEditTask,
    addTask, updateTask, removeTask, addProject, updateProject, setSharing, setClient, removeProject, addNote, updateNote, removeNote,
  }), [scope.kind, uid, projects, tasks, privates, notes, answered, canEditTask, addTask, updateTask, removeTask, addProject, updateProject, setSharing, setClient, removeProject, addNote, updateNote, removeNote]);

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
  const add = useCallback(async (author: string, text: string, authorUid?: string) => {
    if (!taskId || !text.trim()) return;
    await setDoc(doc(collection(db, TASKS, taskId, 'comments')), {
      author, text: text.trim(), at: new Date().toISOString(), ...(authorUid ? { authorUid } : {}),
    });
  }, [taskId]);

  const remove = useCallback(async (id: string) => {
    if (taskId) await deleteDoc(doc(db, TASKS, taskId, 'comments', id));
  }, [taskId]);

  return { comments, add, remove };
}

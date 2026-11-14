import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  arrayUnion, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, where, writeBatch, type Query,
} from 'firebase/firestore';
import { db } from '@/data/firebase';
import { logActivity } from '@/data/activityLog';
import { metered } from '@/data/readMeter';
import { markDeleted, syncCollection } from '@/data/deltaSync';
import { commentedText, createdText, deletedText, statusChangeText, type ActivityType } from '@/domain/activity';
import { playTaskDone } from '@/lib/sound';
import {
  blankNote, canDeleteNote as mayDeleteNote, canEditNote as mayEditNote, canRequestEdit as mayRequestEdit, detachedNote, noteAuthorKey, normalizeNote, noteTitle,
  requestId, staleNoteViewers, viewersOfNote, type NoteViewer,
} from '@/domain/work/notes';
import { blankTask, moveToStatus, nextTaskNo } from '@/domain/work/tasks';
import { adminProjectOf, assignableIn, canEditAsGuest, isAdminOf, isInProject, normalizeProject, normalizeTask, OWNER_KEY, staleViewers, viewersOf } from '@/domain/work/sharing';
import type { Note, NoteEditRequest, Project, ProjectPrivate, Task, TaskComment, TaskStatus } from '@/domain/work/types';

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
const NOTE_REQUESTS = 'note_edit_requests';

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
  /** Notes: all of them for Hamed; for a guest those of their projects and their own. Read from Firestore only once a screen asks (`loadNotes`): a page that does not show notes never pays for them. */
  notes: Note[];
  /** The notes have arrived (always false until `loadNotes` is called). */
  notesReady: boolean;
  /** Starts reading the notes (idempotent; they stay live for the rest of the visit). */
  loadNotes: () => void;
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
  /** A guest changes only the text and title (a note's project is Hamed's to move). */
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'markdown' | 'projectId'>>) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  /** Hamed any note; a guest the ones they wrote and the ones they were given permission for. */
  canEditNote: (note: Note) => boolean;
  /** Hamed any note; a guest only their own. */
  canDeleteNote: (note: Note) => boolean;
  /** A guest who can read a note but not change it may ask. */
  canRequestEdit: (note: Note) => boolean;
  /** Requests for permission this person can answer (all of them for Hamed). */
  requestsToAnswer: NoteEditRequest[];
  /** The requests this guest has made and that are still waiting. */
  myRequests: NoteEditRequest[];
  requestEdit: (note: Note) => Promise<void>;
  /** Answers a request: yes puts the guest among the note's editors; either way the request is taken away. */
  answerEdit: (request: NoteEditRequest, allow: boolean) => Promise<void>;
}

const WorkContext = createContext<WorkContextType | null>(null);

export const WorkProvider: React.FC<{ scope: WorkScope; children: React.ReactNode }> = ({ scope, children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privates, setPrivates] = useState<Record<string, ProjectPrivate>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesWanted, setNotesWanted] = useState(false);
  const [notesReady, setNotesReady] = useState(false);
  const [requestLists, setRequestLists] = useState<{ toAnswer: NoteEditRequest[]; mine: NoteEditRequest[] }>({ toAnswer: [], mine: [] });
  const loadNotes = useCallback(() => setNotesWanted(true), []);
  const [answered, setAnswered] = useState({ projects: false, tasks: false });
  // The mutations below read the latest data without being rebuilt every time it changes.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const uid = scope.kind === 'guest' ? scope.uid : null;
  const guestName = scope.kind === 'guest' ? scope.name : null;
  /** A guest's own actions are written to the log Hamed reads; Hamed's are not. */
  const note = useCallback((type: ActivityType, text: string, taskId?: string) => {
    if (uid) void logActivity({ uid, name: guestName ?? 'Guest', type, text, taskId });
  }, [uid, guestName]);

  useEffect(() => {
    const fail = (name: string) => (error: Error) => console.warn(`Could not listen to ${name}:`, error.message);
    const mine = (name: string, field: string): Query => (uid ? query(collection(db, name), where(field, 'array-contains', uid)) : collection(db, name));
    const showProjects = (docs: ReadonlyArray<{ id: string; data: () => unknown }>) => {
      setProjects(docs.map((d) => normalizeProject({ ...(d.data() as Partial<Project>), id: d.id })));
      setAnswered((a) => ({ ...a, projects: true }));
    };
    // Hamed's projects, like his tasks, are read by their changes only; a guest's are the few they are on.
    const stops = [uid
      ? onSnapshot(mine(PROJECTS, 'memberUids'), metered(PROJECTS, (snap) => showProjects(snap.docs)), fail(PROJECTS))
      : syncCollection(PROJECTS, showProjects, fail(PROJECTS))];
    const showTasks = (docs: ReadonlyArray<{ id: string; data: () => unknown }>) => {
      setTasks(docs.map((d) => normalizeTask({ ...(d.data() as Partial<Task>), id: d.id })));
      setAnswered((a) => ({ ...a, tasks: true }));
    };
    // Hamed's tasks are all of them, his biggest list: read by its changes only (data/deltaSync.ts), so a cold start costs what
    // changed, not every task. A guest's are only those they may see, and are listened to whole.
    stops.push(uid
      ? onSnapshot(mine(TASKS, 'viewerUids'), metered(TASKS, (snap) => showTasks(snap.docs)), fail(TASKS))
      : syncCollection(TASKS, showTasks, fail(TASKS)));
    // Who each project is for, and the notes, are Hamed's alone.
    if (!uid) {
      stops.push(syncCollection(PRIVATES, (docs) => {
        setPrivates(Object.fromEntries(docs.map((d) => [d.id, { ...(d.data() as Omit<ProjectPrivate, 'id'>), id: d.id }])));
      }, fail(PRIVATES)));
    }
    return () => stops.forEach((stop) => stop());
  }, [uid]);

  // Notes are the heaviest thing to read (whole pages of text), so they are listened to only after a screen that shows them asks.
  useEffect(() => {
    if (!notesWanted) return;
    const show = (docs: ReadonlyArray<{ id: string; data: () => unknown }>) => {
      setNotes(docs.map((d) => normalizeNote({ ...(d.data() as Partial<Note>), id: d.id })));
      setNotesReady(true);
    };
    const fail = (error: Error) => { console.warn(`Could not listen to ${NOTES}:`, error.message); setNotesReady(true); };
    // A guest's are the notes that list them (their projects' and their own); Hamed's are all of them, read by their changes only, like the tasks.
    return uid
      ? onSnapshot(query(collection(db, NOTES), where('viewerUids', 'array-contains', uid)), metered(NOTES, (snap) => show(snap.docs)), fail)
      : syncCollection(NOTES, show, fail);
  }, [uid, notesWanted]);

  // The requests for permission to change a note: for Hamed all of them; for a guest those they can answer and those they made.
  useEffect(() => {
    if (!notesWanted) return;
    const fail = (error: Error) => console.warn(`Could not listen to ${NOTE_REQUESTS}:`, error.message);
    const read = (docs: ReadonlyArray<{ id: string; data: () => unknown }>) => docs.map((d) => ({ ...(d.data() as Omit<NoteEditRequest, 'id'>), id: d.id }));
    if (!uid) return onSnapshot(collection(db, NOTE_REQUESTS), metered(NOTE_REQUESTS, (snap) => setRequestLists({ toAnswer: read(snap.docs), mine: [] })), fail);
    const stops = [
      onSnapshot(query(collection(db, NOTE_REQUESTS), where('authorKey', '==', uid)), metered(NOTE_REQUESTS, (snap) => setRequestLists((l) => ({ ...l, toAnswer: read(snap.docs) }))), fail),
      onSnapshot(query(collection(db, NOTE_REQUESTS), where('requesterUid', '==', uid)), metered(NOTE_REQUESTS, (snap) => setRequestLists((l) => ({ ...l, mine: read(snap.docs) }))), fail),
    ];
    return () => stops.forEach((stop) => stop());
  }, [uid, notesWanted]);

  // Notes written before they were shared, or whose project's members changed, have out-of-date readers: Hamed's app brings them
  // up to date. Not stamped with a new `updatedAt` — nothing about the page changed, so it must not jump to the top of "Recent";
  // the readers are only ever read by the rules, never by a screen.
  useEffect(() => {
    if (uid || !notesReady || !answered.projects) return;
    const batch = writeBatch(db);
    let count = 0;
    for (const project of projects) {
      for (const { id, viewerUids, editorUids } of staleNoteViewers(notes, project)) { batch.set(doc(db, NOTES, id), { viewerUids, editorUids }, { merge: true }); count += 1; }
    }
    if (count > 0) batch.commit().catch((error) => console.warn('Could not update who reads the notes:', error.message));
  }, [uid, notes, notesReady, projects, answered.projects]);

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
    void markDeleted(TASKS, id);
    if (gone) note('task_deleted', deletedText(gone.title), id);
  }, [note]);

  const addProject = useCallback(async (input: NewProject, client: string | null = null) => {
    const ref = doc(collection(db, PROJECTS));
    const at = new Date().toISOString();
    const project: Omit<Project, 'id'> = {
      status: 'active', priority: null, lead: null, date: null, endDate: null, memberUids: [], guestsSeeAll: false, adminUids: [], memberProfiles: {}, createdAt: at, updatedAt: at, ...input,
    };
    await setDoc(ref, clean(project));
    if (client) await setDoc(doc(db, PRIVATES, ref.id), { client, updatedAt: at });
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
      // Stamped like every other change to a task, so a device reading the tasks by their changes sees it.
      batch.set(doc(db, TASKS, id), { viewerUids, updatedAt: new Date().toISOString() }, { merge: true });
    }
    // The project's notes are read by its members, so they follow the members too.
    const noteSnap = await getDocs(query(collection(db, NOTES), where('projectId', '==', projectId)));
    const here = noteSnap.docs.map((d) => normalizeNote({ ...(d.data() as Partial<Note>), id: d.id }));
    for (const { id, viewerUids, editorUids } of staleNoteViewers(here, { id: projectId, memberUids })) {
      batch.set(doc(db, NOTES, id), { viewerUids, editorUids, updatedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
  }, []);

  const setClient = useCallback(async (projectId: string, client: string | null) => {
    // Stamped, and its deletion marked, so a device reading these by their changes only (data/deltaSync.ts) sees it.
    if (client?.trim()) await setDoc(doc(db, PRIVATES, projectId), { client: client.trim(), updatedAt: new Date().toISOString() });
    else { await deleteDoc(doc(db, PRIVATES, projectId)); void markDeleted(PRIVATES, projectId); }
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
    // Its notes stay, with no project (and so read by their author alone).
    const noteSnap = await getDocs(query(collection(db, NOTES), where('projectId', '==', id)));
    for (const d of noteSnap.docs) batch.set(doc(db, NOTES, d.id), { ...detachedNote(normalizeNote({ ...(d.data() as Partial<Note>), id: d.id })), updatedAt: new Date().toISOString() }, { merge: true });
    batch.delete(doc(db, PROJECTS, id));
    batch.delete(doc(db, PRIVATES, id));
    await batch.commit();
    void markDeleted(PROJECTS, id);
    void markDeleted(PRIVATES, id);
  }, []);

  const noteViewer = useMemo<NoteViewer>(() => (uid ? { role: 'guest', uid } : { role: 'owner' }), [uid]);
  const canEditNote = useCallback((n: Note) => mayEditNote(n, noteViewer), [noteViewer]);
  const canDeleteNote = useCallback((n: Note) => mayDeleteNote(n, noteViewer), [noteViewer]);
  const canRequestEdit = useCallback((n: Note) => mayRequestEdit(n, noteViewer), [noteViewer]);

  const addNote = useCallback(async (projectId: string | null = null) => {
    const ref = doc(collection(db, NOTES));
    // Whoever makes it is its author; the project's members (or the author alone, with no project) are who can read it.
    await setDoc(ref, clean(blankNote(projectId, uid ? { uid, name: guestName ?? 'Guest' } : null, viewersOfNote(projectId, uid ?? undefined, projectsRef.current))));
    return ref.id;
  }, [uid, guestName]);

  const updateNote = useCallback(async (id: string, patch: Partial<Pick<Note, 'title' | 'markdown' | 'projectId'>>) => {
    const body: Record<string, unknown> = { ...patch, updatedAt: new Date().toISOString() };
    if (uid) delete body.projectId;
    else if ('projectId' in patch) {
      // Moving a note changes who reads it, and nobody but its author may keep permission to change it.
      const now = notesRef.current.find((n) => n.id === id);
      body.viewerUids = viewersOfNote(patch.projectId ?? null, now?.authorUid, projectsRef.current);
      body.editorUids = (now?.editorUids ?? []).filter((who) => (body.viewerUids as string[]).includes(who));
    }
    await setDoc(doc(db, NOTES, id), clean(body), { merge: true });
  }, [uid]);

  const removeNote = useCallback(async (id: string) => {
    await deleteDoc(doc(db, NOTES, id));
    void markDeleted(NOTES, id);
  }, []);

  const requestEdit = useCallback(async (target: Note) => {
    if (!uid) return;
    await setDoc(doc(db, NOTE_REQUESTS, requestId(target.id, uid)), {
      noteId: target.id, noteTitle: noteTitle(target).slice(0, 300), requesterUid: uid, requesterName: guestName ?? 'Guest',
      authorKey: noteAuthorKey(target), at: new Date().toISOString(),
    });
  }, [uid, guestName]);

  const answerEdit = useCallback(async (request: NoteEditRequest, allow: boolean) => {
    const batch = writeBatch(db);
    if (allow) batch.set(doc(db, NOTES, request.noteId), { editorUids: arrayUnion(request.requesterUid), updatedAt: new Date().toISOString() }, { merge: true });
    batch.delete(doc(db, NOTE_REQUESTS, request.id));
    await batch.commit();
  }, []);

  const value = useMemo<WorkContextType>(() => ({
    role: scope.kind, guestUid: uid, me: uid ?? OWNER_KEY, projects, tasks, privates, notes, notesReady, loadNotes, ready: answered.projects && answered.tasks, canEditTask, canDeleteTask, isProjectAdmin,
    addTask, updateTask, setTaskStatus, toggleTaskDone, removeTask, addProject, updateProject, setSharing, setClient, removeProject, addNote, updateNote, removeNote,
    canEditNote, canDeleteNote, canRequestEdit, requestsToAnswer: requestLists.toAnswer, myRequests: requestLists.mine, requestEdit, answerEdit,
  }), [scope.kind, uid, projects, tasks, privates, notes, notesReady, loadNotes, answered, canEditTask, canDeleteTask, isProjectAdmin, addTask, updateTask, setTaskStatus, toggleTaskDone, removeTask, addProject, updateProject, setSharing, setClient, removeProject, addNote, updateNote, removeNote, canEditNote, canDeleteNote, canRequestEdit, requestLists, requestEdit, answerEdit]);

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
      metered('work_tasks/{id}/comments', (snap) => setComments(snap.docs.map((d) => ({ ...(d.data() as Omit<TaskComment, 'id'>), id: d.id })))),
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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '@/data/firebase';
import { blankTask, nextTaskNo } from '@/domain/work/tasks';
import type { Project, ProjectPrivate, Task, TaskComment } from '@/domain/work/types';

/**
 * Projects, tasks and comments, kept live from Firestore for the owner. Each kind is its own collection (a task or
 * a project is a document, not a row in one big value), so edits don't overwrite each other and there is room to grow.
 * `WorkProvider` listens once; every work screen reads from `useWork()`.
 */
const PROJECTS = 'work_projects';
const PRIVATES = 'work_projects_private';
const TASKS = 'work_tasks';

/** Firestore refuses `undefined`; a field that is not there is simply left out. */
const clean = <T extends object>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export type NewTask = Partial<Omit<Task, 'id' | 'no'>> & { title: string };
export type NewProject = Partial<Omit<Project, 'id'>> & { name: string };

interface WorkContextType {
  projects: Project[];
  tasks: Task[];
  /** Who each project is for — the owner's only. */
  privates: Record<string, ProjectPrivate>;
  /** The first answer from Firestore has arrived (before it, lists are empty rather than missing). */
  ready: boolean;
  addTask: (input: NewTask) => Promise<string>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  addProject: (input: NewProject, client?: string | null) => Promise<string>;
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => Promise<void>;
  setClient: (projectId: string, client: string | null) => Promise<void>;
  /** Removes the project and its client record; its tasks stay, with no project. */
  removeProject: (id: string) => Promise<void>;
}

const WorkContext = createContext<WorkContextType | null>(null);

export const WorkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privates, setPrivates] = useState<Record<string, ProjectPrivate>>({});
  const [answered, setAnswered] = useState({ projects: false, tasks: false });
  // The mutations below read the latest tasks without being rebuilt every time they change.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    const fail = (name: string) => (error: Error) => console.warn(`Could not listen to ${name}:`, error.message);
    const stops = [
      onSnapshot(collection(db, PROJECTS), (snap) => {
        setProjects(snap.docs.map((d) => ({ ...(d.data() as Omit<Project, 'id'>), id: d.id })));
        setAnswered((a) => ({ ...a, projects: true }));
      }, fail(PROJECTS)),
      onSnapshot(collection(db, TASKS), (snap) => {
        setTasks(snap.docs.map((d) => ({ ...(d.data() as Omit<Task, 'id'>), id: d.id })));
        setAnswered((a) => ({ ...a, tasks: true }));
      }, fail(TASKS)),
      onSnapshot(collection(db, PRIVATES), (snap) => {
        setPrivates(Object.fromEntries(snap.docs.map((d) => [d.id, { ...(d.data() as Omit<ProjectPrivate, 'id'>), id: d.id }])));
      }, fail(PRIVATES)),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  const addTask = useCallback(async (input: NewTask) => {
    const ref = doc(collection(db, TASKS));
    const { title, ...rest } = input;
    // The number comes from what is loaded now; with one person adding tasks, two never race.
    const base = blankTask(nextTaskNo(tasksRef.current), null);
    await setDoc(ref, clean({ ...base, ...rest, title }));
    return ref.id;
  }, []);

  const updateTask = useCallback(async (id: string, patch: Partial<Omit<Task, 'id'>>) => {
    await setDoc(doc(db, TASKS, id), clean({ ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() }), { merge: true });
  }, []);

  const removeTask = useCallback(async (id: string) => {
    await deleteDoc(doc(db, TASKS, id));
  }, []);

  const addProject = useCallback(async (input: NewProject, client: string | null = null) => {
    const ref = doc(collection(db, PROJECTS));
    const at = new Date().toISOString();
    const project: Omit<Project, 'id'> = {
      status: 'active', priority: null, lead: null, date: null, createdAt: at, updatedAt: at, ...input,
    };
    await setDoc(ref, clean(project));
    if (client) await setDoc(doc(db, PRIVATES, ref.id), { client });
    return ref.id;
  }, []);

  const updateProject = useCallback(async (id: string, patch: Partial<Omit<Project, 'id'>>) => {
    await setDoc(doc(db, PROJECTS, id), clean({ ...patch, updatedAt: new Date().toISOString() }), { merge: true });
  }, []);

  const setClient = useCallback(async (projectId: string, client: string | null) => {
    if (client?.trim()) await setDoc(doc(db, PRIVATES, projectId), { client: client.trim() });
    else await deleteDoc(doc(db, PRIVATES, projectId));
  }, []);

  const removeProject = useCallback(async (id: string) => {
    const batch = writeBatch(db);
    for (const task of tasksRef.current) {
      if (task.projectId === id) batch.set(doc(db, TASKS, task.id), { projectId: null, updatedAt: new Date().toISOString() }, { merge: true });
    }
    batch.delete(doc(db, PROJECTS, id));
    batch.delete(doc(db, PRIVATES, id));
    await batch.commit();
  }, []);

  const value = useMemo<WorkContextType>(() => ({
    projects, tasks, privates, ready: answered.projects && answered.tasks,
    addTask, updateTask, removeTask, addProject, updateProject, setClient, removeProject,
  }), [projects, tasks, privates, answered, addTask, updateTask, removeTask, addProject, updateProject, setClient, removeProject]);

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

  const add = useCallback(async (author: string, text: string) => {
    if (!taskId || !text.trim()) return;
    await setDoc(doc(collection(db, TASKS, taskId, 'comments')), { author, text: text.trim(), at: new Date().toISOString() });
  }, [taskId]);

  const remove = useCallback(async (id: string) => {
    if (taskId) await deleteDoc(doc(db, TASKS, taskId, 'comments', id));
  }, [taskId]);

  return { comments, add, remove };
}

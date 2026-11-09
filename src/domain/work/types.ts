/** The shapes the work side takes (projects, tasks, comments). No behaviour — just contracts. */

export type TaskStatus = 'todo' | 'doing' | 'done' | 'dropped';
export type Priority = 'high' | 'medium' | 'low';
export type ProjectStatus = 'planning' | 'active' | 'maintenance' | 'paused' | 'done';

export interface Task {
  id: string;
  /** A running number, like Notion's Task ID. */
  no: number;
  title: string;
  status: TaskStatus;
  priority: Priority | null;
  /** The day it is for, "YYYY-MM-DD". */
  date: string | null;
  projectId: string | null;
  /** Who it is for, by name (a guest's uid joins in when projects are shared). */
  assignee: string | null;
  /** What kind of thing it is ("بتاعة إيه"). */
  tags: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
  /** When it was finished, for the progress and the history. */
  doneAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: Priority | null;
  lead: string | null;
  /** The project's date, "YYYY-MM-DD". */
  date: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What only the owner may see about a project: who it is for. Kept apart so it can be locked apart. */
export interface ProjectPrivate {
  /** The same id as the project it belongs to. */
  id: string;
  client: string | null;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

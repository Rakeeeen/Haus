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
  /** Who it is for, by name. */
  assignee: string | null;
  /** The uid of who it is for, when that is a guest (Hamed's own tasks have none). */
  assigneeUid: string | null;
  /** The uid of the guest who made it, if a guest did. */
  createdByUid: string | null;
  /**
   * The guests who may see this task (firestore.rules checks it): decided by the project's sharing, see
   * `viewersOf` in sharing.ts. Hamed reads everything and is never listed.
   */
  viewerUids: string[];
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
  /** The guests on this project: they see it, and its tasks as `guestsSeeAll` says. */
  memberUids: string[];
  /** Whether a member sees every task of the project, or only the ones that are theirs. */
  guestsSeeAll: boolean;
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
  /** The guest's uid, if a guest wrote it. */
  authorUid?: string;
  text: string;
  at: string;
}

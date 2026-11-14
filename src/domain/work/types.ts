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
  /** The day it starts (or is for), "YYYY-MM-DD". */
  date: string | null;
  /** The day it ends, when it spans days; null for a one-day task. */
  endDate: string | null;
  /** The task's first project (what older code and the bot read); always `projectIds[0]`. */
  projectId: string | null;
  /** Every project it belongs to — a task can be in several. */
  projectIds: string[];
  /** Who it is for, by name — the first of `assigneeUids` (what older code and the bot read). */
  assignee: string | null;
  /** The uid of the first person it is for, when that is a guest (null when it is Hamed's). */
  assigneeUid: string | null;
  /**
   * Everyone it is for: Hamed as `OWNER_KEY` and guests by uid. A task can be for several people. Older tasks have no
   * list; `normalizeTask` fills it from `assigneeUid` (or Hamed, when there was none).
   */
  assigneeUids: string[];
  /** The uid of the guest who made it, if a guest did. */
  createdByUid: string | null;
  /** The project admin who last changed it (set only when an admin does; Hamed's own changes reset it to null). Tells the bot whose doing a change was. */
  updatedByUid?: string | null;
  /**
   * The guests who may see this task (firestore.rules checks it): decided by the project's sharing, see
   * `viewersOf` in sharing.ts. Hamed reads everything and is never listed.
   */
  viewerUids: string[];
  /** Labels the Notion import brought over. The app neither shows nor edits them; they are kept so nothing imported is lost. */
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
  /** The day the project starts, "YYYY-MM-DD". */
  date: string | null;
  /** The day it ends, if it has an end. */
  endDate: string | null;
  /** The guests on this project: they see it, and its tasks as `guestsSeeAll` says. */
  memberUids: string[];
  /** Whether a member sees every task of the project, or only the ones that are theirs. */
  guestsSeeAll: boolean;
  /**
   * The members who run the project with Hamed (a subset of `memberUids`): they see every task of it, add and change its
   * tasks and give them to other members, and change its name, status, priority and dates — never who is on it.
   */
  adminUids: string[];
  /** Who the members are by name and photo, written by Hamed's app when he shares the project: a guest can't read the guest list. Hamed is `OWNER_KEY`. */
  memberProfiles: Record<string, { name: string; photoUrl: string | null }>;
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

/**
 * A note: a page of writing, kept as Markdown, optionally about a project. Its project's members see it; a note with no project
 * is its author's alone. Its author (and Hamed) change it; anyone else only with permission (`editorUids`, see `NoteEditRequest`).
 */
export interface Note {
  id: string;
  title: string;
  markdown: string;
  projectId: string | null;
  /** The guest who wrote it; absent when Hamed did (so Hamed's notes carry no author key, and the rules read them as 'owner'). */
  authorUid?: string;
  /** The author's first name, for the list (a guest can't read the guest list). */
  authorName?: string;
  /** The guests who may read it, written from the project's members (firestore.rules checks it). Hamed reads everything. */
  viewerUids: string[];
  /** The guests, besides its author, who were given permission to change it. */
  editorUids: string[];
  createdAt: string;
  updatedAt: string;
}

/** A guest asking the author of a note (or Hamed, for his) for permission to change it. Its id is `<noteId>_<requesterUid>`. */
export interface NoteEditRequest {
  id: string;
  noteId: string;
  noteTitle: string;
  requesterUid: string;
  requesterName: string;
  /** Who can answer: the author's uid, or `OWNER_KEY` for a note Hamed wrote. */
  authorKey: string;
  at: string;
}

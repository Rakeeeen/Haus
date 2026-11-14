import { OWNER_KEY } from '@/domain/work/sharing';
import type { Note, NoteEditRequest, Project } from '@/domain/work/types';

/** A note's title, or what to call it while it has none. */
export const noteTitle = (note: Pick<Note, 'title'>): string => note.title.trim() || 'Untitled';

/**
 * The first words of a note as plain text, for a list: the Markdown marks (headings, bold, lists, checkboxes, links)
 * are taken out, and the lines are joined with spaces.
 */
export function notePreview(markdown: string, max = 140): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}([-*+] \[[ xX]\]|#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/^\s*(---|\*\*\*|___)\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Newest edit first. */
export const sortNotes = (notes: readonly Note[]): Note[] => [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

/** Notes that mention `text` in their title or body (case-insensitive); an empty search matches all. */
export function searchNotes(notes: readonly Note[], text: string): Note[] {
  const needle = text.trim().toLowerCase();
  if (!needle) return [...notes];
  return notes.filter((n) => n.title.toLowerCase().includes(needle) || n.markdown.toLowerCase().includes(needle));
}

/** The notes in groups by project — newest note first within each, groups A to Z, the notes with no project last. */
export function groupNotesByProject(
  notes: readonly Note[],
  projectName: (id: string) => string | null,
): Array<{ projectId: string | null; label: string; notes: Note[] }> {
  const groups = new Map<string | null, Note[]>();
  for (const note of sortNotes(notes)) {
    const key = note.projectId && projectName(note.projectId) ? note.projectId : null;
    groups.set(key, [...(groups.get(key) ?? []), note]);
  }
  return [...groups.entries()]
    .map(([projectId, list]) => ({ projectId, label: projectId ? projectName(projectId) ?? '' : 'No project', notes: list }))
    .sort((a, b) => (a.projectId === null ? 1 : b.projectId === null ? -1 : a.label.localeCompare(b.label)));
}

/** Fills what an older note does not have, so the rest of the app can count on every field. */
export function normalizeNote(raw: Partial<Note> & { id: string }): Note {
  return { title: '', markdown: '', projectId: null, createdAt: '', updatedAt: '', ...raw, viewerUids: raw.viewerUids ?? [], editorUids: raw.editorUids ?? [] };
}

/** Who a note is Hamed's or a guest's: `OWNER_KEY`, or the guest's uid. */
export const noteAuthorKey = (note: Pick<Note, 'authorUid'>): string => note.authorUid ?? OWNER_KEY;

/**
 * The guests who may read a note (written onto it for the rules): a project's note is read by the project's members; a note
 * with no project only by its author, if that is a guest. Hamed needs no listing.
 */
export function viewersOfNote(projectId: string | null, authorUid: string | undefined, projects: readonly Pick<Project, 'id' | 'memberUids'>[]): string[] {
  if (!projectId) return authorUid ? [authorUid] : [];
  return [...(projects.find((p) => p.id === projectId)?.memberUids ?? [])];
}

/** Who is looking, as the permission rules need to know them: Hamed, or a guest by uid. */
export type NoteViewer = { role: 'owner' } | { role: 'guest'; uid: string };

/** Hamed changes every note; a guest changes the notes they wrote and the ones they were given permission for. */
export function canEditNote(note: Pick<Note, 'authorUid' | 'editorUids'>, viewer: NoteViewer): boolean {
  return viewer.role === 'owner' || note.authorUid === viewer.uid || note.editorUids.includes(viewer.uid);
}

/** Only Hamed and the note's author may delete it (permission to change a note is not permission to remove it). */
export function canDeleteNote(note: Pick<Note, 'authorUid'>, viewer: NoteViewer): boolean {
  return viewer.role === 'owner' || note.authorUid === viewer.uid;
}

/** Whether a guest who can only read a note may ask to change it. */
export const canRequestEdit = (note: Pick<Note, 'authorUid' | 'editorUids'>, viewer: NoteViewer): boolean =>
  viewer.role === 'guest' && !canEditNote(note, viewer);

/** Whether `viewer` answers requests about this note: its author, or Hamed (for all of them). */
export const canAnswerRequest = (request: Pick<NoteEditRequest, 'authorKey'>, viewer: NoteViewer): boolean =>
  viewer.role === 'owner' || request.authorKey === viewer.uid;

/** The id of a request: one per note and person. */
export const requestId = (noteId: string, requesterUid: string): string => `${noteId}_${requesterUid}`;

/**
 * A project's notes whose readers are out of date after the project's members changed (or that were written before notes were
 * shared). Whoever can no longer read a note can no longer be given permission to change it, so `editorUids` is trimmed too.
 */
export function staleNoteViewers(
  notes: readonly Note[],
  project: Pick<Project, 'id' | 'memberUids'>,
): Array<{ id: string; viewerUids: string[]; editorUids: string[] }> {
  const same = (a: readonly string[], b: readonly string[]) => [...a].sort().join('|') === [...b].sort().join('|');
  return notes
    .filter((n) => n.projectId === project.id)
    .map((n) => {
      const viewerUids = viewersOfNote(n.projectId, n.authorUid, [project]);
      return { note: n, viewerUids, editorUids: n.editorUids.filter((uid) => viewerUids.includes(uid)) };
    })
    .filter(({ note, viewerUids, editorUids }) => !same(note.viewerUids, viewerUids) || !same(note.editorUids, editorUids))
    .map(({ note, viewerUids, editorUids }) => ({ id: note.id, viewerUids, editorUids }));
}

/** What a note becomes when its project is removed: no project, read by its author alone, nobody else changing it. */
export function detachedNote(note: Pick<Note, 'authorUid'>): { projectId: null; viewerUids: string[]; editorUids: string[] } {
  return { projectId: null, viewerUids: note.authorUid ? [note.authorUid] : [], editorUids: [] };
}

/** A blank note for the editor. A guest's carries their uid and first name; Hamed's carries neither. */
export function blankNote(
  projectId: string | null,
  author: { uid: string; name: string } | null = null,
  viewerUids: string[] = [],
  now: Date = new Date(),
): Omit<Note, 'id'> {
  const at = now.toISOString();
  return {
    title: '', markdown: '', projectId, ...(author ? { authorUid: author.uid, authorName: author.name } : {}),
    viewerUids, editorUids: [], createdAt: at, updatedAt: at,
  };
}

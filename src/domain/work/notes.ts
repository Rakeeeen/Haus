import type { Note } from '@/domain/work/types';

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

/** A blank note for the editor. */
export function blankNote(projectId: string | null, now: Date = new Date()): Omit<Note, 'id'> {
  const at = now.toISOString();
  return { title: '', markdown: '', projectId, createdAt: at, updatedAt: at };
}

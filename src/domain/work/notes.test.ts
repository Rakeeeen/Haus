import { describe, it, expect } from 'vitest';
import { blankNote, groupNotesByProject, noteTitle, notePreview, searchNotes, sortNotes } from '@/domain/work/notes';
import type { Note } from '@/domain/work/types';

const note = (over: Partial<Note> = {}): Note => ({ id: 'n', title: 'T', markdown: '', projectId: null, createdAt: '', updatedAt: '2026-11-01T00:00:00.000Z', ...over });

describe('notePreview', () => {
  it('takes the Markdown marks out and joins the lines', () => {
    expect(notePreview('# Meeting\n\n- **Budget** is [here](http://x)\n- [ ] call him\n> quoted')).toBe('Meeting Budget is here call him quoted');
  });
  it('leaves code and images out', () => {
    expect(notePreview('before\n```js\nconst a = 1\n```\n![pic](a.png)\nafter')).toBe('before after');
  });
  it('cuts a long note with an ellipsis', () => {
    expect(notePreview('word '.repeat(60), 20)).toMatch(/^word word word word…$/);
  });
  it('keeps Arabic as it is', () => {
    expect(notePreview('## اجتماع\n\nنقاط **مهمة**')).toBe('اجتماع نقاط مهمة');
  });
});

describe('noteTitle', () => {
  it('falls back to Untitled', () => {
    expect(noteTitle({ title: '  ' })).toBe('Untitled');
    expect(noteTitle({ title: 'Plan' })).toBe('Plan');
  });
});

describe('sortNotes / searchNotes', () => {
  it('puts the newest edit first', () => {
    expect(sortNotes([note({ id: 'a', updatedAt: '2026-01-01' }), note({ id: 'b', updatedAt: '2026-03-01' })]).map((n) => n.id)).toEqual(['b', 'a']);
  });
  it('finds a word in the title or the body, ignoring case', () => {
    const list = [note({ id: 'a', title: 'Budget' }), note({ id: 'b', markdown: 'the BUDGET is…' }), note({ id: 'c', title: 'Other' })];
    expect(searchNotes(list, ' budget ').map((n) => n.id)).toEqual(['a', 'b']);
    expect(searchNotes(list, '')).toHaveLength(3);
  });
});

describe('groupNotesByProject', () => {
  const names: Record<string, string> = { p1: 'Zed', p2: 'Amr' };
  it('groups A to Z with the unassigned last, newest first inside each', () => {
    const groups = groupNotesByProject([
      note({ id: 'a', projectId: 'p1', updatedAt: '2026-01-01' }), note({ id: 'b', projectId: 'p2' }), note({ id: 'c', projectId: 'p1', updatedAt: '2026-05-01' }), note({ id: 'd' }),
    ], (id) => names[id] ?? null);
    expect(groups.map((g) => g.label)).toEqual(['Amr', 'Zed', 'No project']);
    expect(groups[1].notes.map((n) => n.id)).toEqual(['c', 'a']);
  });
  it('puts a note whose project is gone with no project', () => {
    expect(groupNotesByProject([note({ projectId: 'gone' })], () => null)[0].label).toBe('No project');
  });
});

describe('blankNote', () => {
  it('is empty, for the project given', () => {
    expect(blankNote('p1', new Date('2026-11-09T10:00:00Z'))).toEqual({ title: '', markdown: '', projectId: 'p1', createdAt: '2026-11-09T10:00:00.000Z', updatedAt: '2026-11-09T10:00:00.000Z' });
  });
});

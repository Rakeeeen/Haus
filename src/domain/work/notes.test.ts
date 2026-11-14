import { describe, it, expect } from 'vitest';
import {
  blankNote, canAnswerRequest, canDeleteNote, canEditNote, canRequestEdit, detachedNote, groupNotesByProject, noteAuthorKey, normalizeNote, noteTitle, notePreview, requestId,
  searchNotes, sortNotes, staleNoteViewers, viewersOfNote,
} from '@/domain/work/notes';
import type { Note } from '@/domain/work/types';

const note = (over: Partial<Note> = {}): Note => ({ id: 'n', title: 'T', markdown: '', projectId: null, viewerUids: [], editorUids: [], createdAt: '', updatedAt: '2026-11-01T00:00:00.000Z', ...over });

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
  it('is empty, stamped, and carries no author when Hamed starts it', () => {
    expect(blankNote('p1', null, ['g1'], new Date('2026-11-09T10:00:00Z'))).toEqual({ title: '', markdown: '', projectId: 'p1', viewerUids: ['g1'], editorUids: [], createdAt: '2026-11-09T10:00:00.000Z', updatedAt: '2026-11-09T10:00:00.000Z' });
  });
  it('carries the guest\'s uid and name when a guest starts it', () => {
    expect(blankNote(null, { uid: 'g1', name: 'Sara' }, ['g1'], new Date('2026-11-09T10:00:00Z'))).toMatchObject({ authorUid: 'g1', authorName: 'Sara', viewerUids: ['g1'], editorUids: [] });
  });
});

const proj = { id: 'p1', memberUids: ['g1', 'g2'] };

describe('normalizeNote', () => {
  it('fills the lists an older note lacks', () => {
    expect(normalizeNote({ id: 'x', title: 'A' })).toMatchObject({ id: 'x', title: 'A', viewerUids: [], editorUids: [], projectId: null });
  });
});

describe('viewersOfNote', () => {
  it('is the project\'s members for a project note', () => {
    expect(viewersOfNote('p1', 'g1', [proj])).toEqual(['g1', 'g2']);
    expect(viewersOfNote('p1', undefined, [proj])).toEqual(['g1', 'g2']);
  });
  it('is the author alone for a note with no project, and nobody for Hamed\'s', () => {
    expect(viewersOfNote(null, 'g1', [proj])).toEqual(['g1']);
    expect(viewersOfNote(null, undefined, [proj])).toEqual([]);
  });
  it('is nobody when the project is gone', () => {
    expect(viewersOfNote('gone', 'g1', [proj])).toEqual([]);
  });
});

describe('who may change a note', () => {
  const sara = { role: 'guest', uid: 'g1' } as const;
  const omar = { role: 'guest', uid: 'g2' } as const;
  const owner = { role: 'owner' } as const;
  it('lets Hamed change and delete everything', () => {
    expect(canEditNote(note({ authorUid: 'g1' }), owner)).toBe(true);
    expect(canDeleteNote(note({ authorUid: 'g1' }), owner)).toBe(true);
  });
  it('lets a guest change and delete their own', () => {
    expect(canEditNote(note({ authorUid: 'g1' }), sara)).toBe(true);
    expect(canDeleteNote(note({ authorUid: 'g1' }), sara)).toBe(true);
  });
  it('lets another guest read only — until given permission, which still does not let them delete', () => {
    expect(canEditNote(note({ authorUid: 'g1' }), omar)).toBe(false);
    expect(canEditNote(note({ authorUid: 'g1', editorUids: ['g2'] }), omar)).toBe(true);
    expect(canDeleteNote(note({ authorUid: 'g1', editorUids: ['g2'] }), omar)).toBe(false);
  });
  it('treats a note with no author as Hamed\'s', () => {
    expect(canEditNote(note(), sara)).toBe(false);
    expect(canDeleteNote(note(), sara)).toBe(false);
  });
  it('lets only a guest who cannot change a note ask to', () => {
    expect(canRequestEdit(note({ authorUid: 'g1' }), omar)).toBe(true);
    expect(canRequestEdit(note({ authorUid: 'g1' }), sara)).toBe(false);
    expect(canRequestEdit(note({ authorUid: 'g1', editorUids: ['g2'] }), omar)).toBe(false);
    expect(canRequestEdit(note(), owner)).toBe(false);
  });
});

describe('requests', () => {
  it('are answered by the note\'s author, or Hamed', () => {
    expect(canAnswerRequest({ authorKey: 'g1' }, { role: 'guest', uid: 'g1' })).toBe(true);
    expect(canAnswerRequest({ authorKey: 'g1' }, { role: 'guest', uid: 'g2' })).toBe(false);
    expect(canAnswerRequest({ authorKey: 'g1' }, { role: 'owner' })).toBe(true);
    expect(canAnswerRequest({ authorKey: 'owner' }, { role: 'guest', uid: 'g1' })).toBe(false);
  });
  it('have an id per note and person', () => {
    expect(requestId('n1', 'g2')).toBe('n1_g2');
    expect(noteAuthorKey({})).toBe('owner');
    expect(noteAuthorKey({ authorUid: 'g1' })).toBe('g1');
  });
});

describe('detachedNote', () => {
  it('leaves a guest\'s note to its author, and Hamed\'s to nobody', () => {
    expect(detachedNote({ authorUid: 'g1' })).toEqual({ projectId: null, viewerUids: ['g1'], editorUids: [] });
    expect(detachedNote({})).toEqual({ projectId: null, viewerUids: [], editorUids: [] });
  });
});

describe('staleNoteViewers', () => {
  it('lists the project\'s notes whose readers no longer match its members', () => {
    const notes = [note({ id: 'a', projectId: 'p1', viewerUids: ['g1'] }), note({ id: 'b', projectId: 'p1', viewerUids: ['g2', 'g1'] }), note({ id: 'c', projectId: 'p2', viewerUids: [] })];
    expect(staleNoteViewers(notes, proj)).toEqual([{ id: 'a', viewerUids: ['g1', 'g2'], editorUids: [] }]);
  });
  it('takes permission away from someone who left the project', () => {
    const notes = [note({ id: 'a', projectId: 'p1', authorUid: 'g1', viewerUids: ['g1', 'g2', 'g3'], editorUids: ['g3'] })];
    expect(staleNoteViewers(notes, proj)).toEqual([{ id: 'a', viewerUids: ['g1', 'g2'], editorUids: [] }]);
  });
  it('finds a note written before sharing, which has no readers yet', () => {
    expect(staleNoteViewers([note({ id: 'old', projectId: 'p1' })], proj)).toEqual([{ id: 'old', viewerUids: ['g1', 'g2'], editorUids: [] }]);
  });
});

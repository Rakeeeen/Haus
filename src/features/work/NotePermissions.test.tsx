// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canDeleteNote, canEditNote, canRequestEdit, normalizeNote } from '@/domain/work/notes';
import type { Note, NoteEditRequest } from '@/domain/work/types';

// A guest, Omar, looking at a note Sara wrote in a project they are both on.
const sara = normalizeNote({ id: 'n1', title: 'Plan', markdown: 'text', projectId: 'p1', authorUid: 'sara', authorName: 'Sara', viewerUids: ['sara', 'omar'] });
const omar = { role: 'guest', uid: 'omar' } as const;
const state: { notes: Note[]; myRequests: NoteEditRequest[]; requestsToAnswer: NoteEditRequest[] } = { notes: [sara], myRequests: [], requestsToAnswer: [] };
const requestEdit = vi.fn(() => Promise.resolve());
const answerEdit = vi.fn(() => Promise.resolve());
const work = () => ({
  role: 'guest', me: 'omar', ready: true, notesReady: true, projects: [{ id: 'p1', name: 'Brand' }], loadNotes: vi.fn(), updateNote: vi.fn(), removeNote: vi.fn(),
  notes: state.notes, myRequests: state.myRequests, requestsToAnswer: state.requestsToAnswer, requestEdit, answerEdit,
  canEditNote: (n: Note) => canEditNote(n, omar), canDeleteNote: (n: Note) => canDeleteNote(n, omar), canRequestEdit: (n: Note) => canRequestEdit(n, omar),
});
vi.mock('@/data/useWork', () => ({ useWork: () => work(), useWorkOptional: () => work() }));
vi.mock('@/features/work/components/NoteEditor', () => ({ NoteEditor: ({ editable }: { editable?: boolean }) => <div data-testid="editor" data-editable={String(editable)} /> }));
vi.mock('@/features/work/components/WorkShell', () => ({ WorkShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import { NotePage } from '@/features/work/NotePage';
import { NoteRequests } from '@/features/work/components/NoteRequests';

const page = () => render(<MemoryRouter initialEntries={['/work/notes/n1']}><Routes><Route path="/work/notes/:id" element={<NotePage navigate={vi.fn()} />} /></Routes></MemoryRouter>);

beforeEach(() => { state.notes = [sara]; state.myRequests = []; state.requestsToAnswer = []; requestEdit.mockClear(); answerEdit.mockClear(); });

describe('a note someone else wrote', () => {
  it('is only read, with no delete, and can be asked about', async () => {
    page();
    expect(screen.getByTestId('editor').getAttribute('data-editable')).toBe('false');
    expect((screen.getByLabelText('Title') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ask to edit' }));
    expect(requestEdit).toHaveBeenCalledWith(sara);
  });

  it('says it is waiting once asked, and does not offer to ask again', () => {
    state.myRequests = [{ id: 'n1_omar', noteId: 'n1', noteTitle: 'Plan', requesterUid: 'omar', requesterName: 'Omar', authorKey: 'sara', at: '2026-11-09T10:00:00Z' }];
    page();
    expect(screen.getByText(/Waiting for Sara/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ask to edit' })).toBeNull();
  });

  it('can be edited once permission is given — still never deleted', () => {
    state.notes = [{ ...sara, editorUids: ['omar'] }];
    page();
    expect(screen.getByTestId('editor').getAttribute('data-editable')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Ask to edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });
});

describe('the requests for a note I wrote', () => {
  it('can be allowed or declined, and one for a deleted note is not shown', async () => {
    state.requestsToAnswer = [
      { id: 'n1_lina', noteId: 'n1', noteTitle: 'Plan', requesterUid: 'lina', requesterName: 'Lina', authorKey: 'omar', at: '2026-11-09T10:00:00Z' },
      { id: 'gone_lina', noteId: 'gone', noteTitle: 'Old', requesterUid: 'lina', requesterName: 'Lina', authorKey: 'omar', at: '2026-11-08T10:00:00Z' },
    ];
    render(<NoteRequests />);
    expect(screen.getAllByText(/wants to edit/)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(answerEdit).toHaveBeenCalledWith(state.requestsToAnswer[0], true);
  });
});

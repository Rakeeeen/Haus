import React, { useEffect, useMemo, useState } from 'react';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { groupNotesByProject, noteTitle, notePreview, searchNotes, sortNotes } from '@/domain/work/notes';
import type { Note } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Form';
import { IconPlus as Plus } from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';
import { shortDate } from '@/features/work/components/chips';
import { WorkShell } from '@/features/work/components/WorkShell';

type View = 'recent' | 'projects';

/** A note as a row of a list: its title, the start of its text, and when it was last edited. */
export const NoteRow: React.FC<{ note: Note; projectName: string | null; onOpen: () => void }> = ({ note, projectName, onOpen }) => (
  <div onClick={onOpen} className="px-5 py-4 border-b border-ink/6 last:border-b-0 cursor-pointer hover:bg-ink/4 transition-colors">
    <div className="flex items-baseline justify-between gap-4">
      <span dir="auto" className="font-sans-main text-[14px] font-bold truncate">{noteTitle(note)}</span>
      <span className="font-mono-main text-[9px] uppercase tracking-wider text-ink/35 shrink-0">{shortDate(note.updatedAt.slice(0, 10))}</span>
    </div>
    <p dir="auto" className="font-mono-main text-[11px] text-ink/45 mt-1 line-clamp-2">{notePreview(note.markdown) || 'Empty'}</p>
    {projectName && <p dir="auto" className="font-mono-main text-[9px] uppercase tracking-wider text-ink/35 mt-1.5">{projectName}</p>}
  </div>
);

export const Notes: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const { notes, projects, ready, addNote } = useWork();
  const [view, setView] = useState<View>('recent');
  const [query, setQuery] = useState('');

  useEffect(() => { document.title = `${NAME} — Notes`; }, []);

  const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectName = (id: string | null) => (id ? names.get(id) ?? null : null);
  const found = searchNotes(notes, query);

  const create = async () => navigate(`work/notes/${await addNote()}`);

  return (
    <WorkShell
      navigate={navigate}
      crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Notes' }]}
      title="Notes"
      actions={<Button onClick={create}><Plus size={16} />New note</Button>}
    >
      <Tabs options={[{ value: 'recent', label: 'Recent' }, { value: 'projects', label: 'By project' }]} value={view} onChange={setView} layoutId="work-notes-view" ruled />
      <TextInput dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="!w-64 !py-2 !text-[12px]" aria-label="Search notes" />

      {!ready ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Loading…</p>
      ) : found.length === 0 ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">{notes.length === 0 ? 'No notes yet.' : 'Nothing found.'}</p>
      ) : view === 'recent' ? (
        <div className="card !p-0 overflow-hidden">
          {sortNotes(found).map((note) => <NoteRow key={note.id} note={note} projectName={projectName(note.projectId)} onOpen={() => navigate(`work/notes/${note.id}`)} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupNotesByProject(found, (id) => names.get(id) ?? null).map((group) => (
            <div key={group.projectId ?? 'none'}>
              <p dir="auto" className="font-mono-main text-[10px] uppercase tracking-[0.2em] font-bold text-ink/50 mb-2.5">{group.label} <span className="text-ink/30">{group.notes.length}</span></p>
              <div className="card !p-0 overflow-hidden">
                {group.notes.map((note) => <NoteRow key={note.id} note={note} projectName={null} onOpen={() => navigate(`work/notes/${note.id}`)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkShell>
  );
};

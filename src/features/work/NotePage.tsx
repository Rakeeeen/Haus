import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { noteTitle } from '@/domain/work/notes';
import { Button } from '@/ui/Button';
import { SelectMenu } from '@/ui/Form';
import { NoteEditor } from '@/features/work/components/NoteEditor';
import { WorkShell } from '@/features/work/components/WorkShell';

const SAVE_AFTER_MS = 800;

/** One note: a title, the project it is about, and the page. Every change is saved a moment after it stops. */
export const NotePage: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const { id } = useParams<{ id: string }>();
  const { notes, projects, ready, updateNote, removeNote } = useWork();
  const note = notes.find((n) => n.id === id) ?? null;

  // What is on screen leads: the page is typed into, then written out, and the copy that comes back is not read again.
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const [sure, setSure] = useState(false);
  const loaded = useRef<string | null>(null);
  const pending = useRef<{ title?: string; markdown?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { document.title = `${NAME} — ${note ? noteTitle(note) : 'Note'}`; }, [note]);

  useEffect(() => {
    if (note && loaded.current !== note.id) { loaded.current = note.id; setTitle(note.title); }
  }, [note]);

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const patch = pending.current;
    if (!patch || !id) return;
    pending.current = null;
    updateNote(id, patch).then(() => setStatus(pending.current ? 'saving' : 'saved'));
  };

  const queue = (patch: { title?: string; markdown?: string }) => {
    pending.current = { ...pending.current, ...patch };
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_AFTER_MS);
  };

  // Leaving the page (or the tab) saves what is waiting.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [id]);

  const crumbs = [{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Notes', to: 'work/notes' }];

  if (ready && !note) {
    return <WorkShell navigate={navigate} crumbs={crumbs} title="Not found"><p className="font-mono-main text-[11px] text-ink/50">There is no such note — it may have been deleted.</p></WorkShell>;
  }
  if (!note) return <WorkShell navigate={navigate} crumbs={crumbs} title="…"><span /></WorkShell>;

  return (
    <WorkShell
      navigate={navigate}
      crumbs={[...crumbs, { label: noteTitle({ title }) }]}
      title="Note"
      actions={<span className="font-mono-main text-[10px] uppercase tracking-widest text-ink/35">{status === 'saving' ? 'Saving…' : 'Saved'}</span>}
    >
      <div className="card flex flex-col gap-6 max-w-[820px] w-full mx-auto !p-6 sm:!p-10">
        <input
          dir="auto"
          value={title}
          onChange={(e) => { setTitle(e.target.value); queue({ title: e.target.value }); }}
          placeholder="Untitled"
          aria-label="Title"
          className="w-full bg-transparent outline-none font-sans-main text-3xl sm:text-4xl font-black leading-[1.5] py-1 placeholder:text-ink/20"
        />
        <div className="max-w-[320px]">
          <SelectMenu
            ariaLabel="Project"
            value={note.projectId ?? ''}
            onChange={(v) => updateNote(note.id, { projectId: v || null })}
            options={[{ value: '', label: 'No project' }, ...[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
        <NoteEditor key={note.id} markdown={note.markdown} onChange={(markdown) => queue({ markdown })} />
        <div className="flex justify-end pt-4 border-t border-ink/8">
          <Button tone="danger" size="sm" onClick={() => (sure ? removeNote(note.id).then(() => navigate('work/notes')) : setSure(true))}>
            {sure ? 'Sure? Delete' : 'Delete note'}
          </Button>
        </div>
      </div>
    </WorkShell>
  );
};

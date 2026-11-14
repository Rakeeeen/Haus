import React, { useState } from 'react';
import { useWork } from '@/data/useWork';
import { Button } from '@/ui/Button';

/**
 * The requests for permission to change a note that this person can answer (all of them for Hamed; a guest's are for the
 * notes they wrote). Allowing puts the guest among the note's editors; declining just takes the request away. A request whose
 * note has been deleted is not shown.
 */
export const NoteRequests: React.FC = () => {
  const { requestsToAnswer, notes, answerEdit } = useWork();
  const [busy, setBusy] = useState<string | null>(null);
  const open = requestsToAnswer.filter((r) => notes.some((n) => n.id === r.noteId)).sort((a, b) => (a.at < b.at ? 1 : -1));
  if (open.length === 0) return null;

  const answer = async (id: string, allow: boolean) => {
    setBusy(id);
    try { await answerEdit(open.find((r) => r.id === id)!, allow); } finally { setBusy(null); }
  };

  return (
    <section aria-label="Requests to edit" className="card !p-0 overflow-hidden mb-2">
      {open.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-ink/6 last:border-b-0">
          <p dir="auto" className="font-sans-main text-[15px] min-w-0">
            <span className="font-bold">{r.requesterName}</span> wants to edit <span className="font-bold">“{r.noteTitle.trim() || 'Untitled'}”</span>
          </p>
          <div className="spring-group flex gap-2 shrink-0">
            <Button size="sm" onClick={() => answer(r.id, true)} disabled={busy === r.id}>Allow</Button>
            <Button size="sm" tone="outline" onClick={() => answer(r.id, false)} disabled={busy === r.id}>Decline</Button>
          </div>
        </div>
      ))}
    </section>
  );
};

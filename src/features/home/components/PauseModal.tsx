import React, { useState } from 'react';
import { MAX_PAUSE_MESSAGE } from '@/domain/pause';
import { AppModal } from '@/ui/AppModal';
import { Button } from '@/ui/Button';

/** Asks before pausing Haus for every guest, and takes an optional line to show them. (Resuming needs no question.) */
export const PauseModal: React.FC<{ isOpen: boolean; onClose: () => void; onPause: (message: string) => Promise<void> }> = ({ isOpen, onClose, onPause }) => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const pause = async () => {
    setBusy(true);
    setProblem('');
    try { await onPause(message); setMessage(''); onClose(); } catch (e) { setProblem(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Pause Haus for everyone?">
      <p className="font-mono-main text-[11px] leading-relaxed text-ink/60 mb-5">
        Every guest sees a resting page instead of the system until you switch it back on — then it opens for them by itself.
        Your own screen is not affected, and nothing is lost.
      </p>
      <input
        dir="auto"
        value={message}
        maxLength={MAX_PAUSE_MESSAGE}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="A line for them (optional) — e.g. back at 9"
        aria-label="Message for guests"
        className="w-full font-mono-main outline-none bg-ink/5 border border-ink/12 focus:border-ink text-ink rounded-box px-4 py-3 text-[14px] mb-5"
      />
      {problem && <p className="font-mono-main text-[10px] text-rust mb-4 break-words">{problem}</p>}
      <div className="spring-group flex gap-3">
        <Button tone="outline" onClick={onClose} disabled={busy} className="flex-1">Cancel</Button>
        <Button onClick={pause} disabled={busy} className="flex-1">Pause Haus</Button>
      </div>
    </AppModal>
  );
};

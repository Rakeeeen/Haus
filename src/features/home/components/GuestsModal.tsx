import React, { useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { Button, IconButton } from '@/ui/Button';
import { IconTrash2 as Trash2 } from '@/ui/icons';
import { GUEST_STATUS_LABEL, type GuestStatus, type Invitation } from '@/domain/access';
import { Avatar } from '@/ui/Avatar';
import { Chip } from '@/ui/Chip';

const input = 'w-full font-mono-main outline-none transition-colors bg-ink/5 border border-ink/12 focus:border-ink text-ink rounded-box px-4 py-3 text-[14px]';

/**
 * The owner's guest list: who is invited to Haus, with a switch to turn someone off without
 * forgetting them. A guest signs in with the Google account of the email invited here.
 */
export const GuestsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  guests: readonly Invitation[];
  statuses?: Record<string, GuestStatus>;
  error: string;
  onInvite: (email: string, name?: string) => Promise<void>;
  onSetActive: (guest: Invitation, active: boolean) => Promise<void>;
  onRemove: (email: string) => Promise<void>;
}> = ({ isOpen, onClose, guests, statuses = {}, error, onInvite, onSetActive, onRemove }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setProblem('');
    try { await job(); } catch (e) { setProblem(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => { await onInvite(email, name); setEmail(''); setName(''); });
  };

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Guests">
      <p className="font-mono-main text-[10px] leading-relaxed text-ink/50 mb-5">
        A guest signs in with the Google account of the email you invite. They get their own water, focus and time —
        never your finance.
      </p>

      <form onSubmit={invite} className="flex flex-col gap-3 mb-6">
        <input className={input} type="email" placeholder="Google email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Guest's Google email" />
        <input className={input} type="text" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Guest's name" />
        <Button type="submit" disabled={busy || !email.trim()} className="w-full">Invite</Button>
      </form>

      {(problem || error) && <p className="font-mono-main text-[10px] text-rust mb-4 break-words">{problem || error}</p>}

      <div className="flex flex-col">
        {guests.length === 0 && <p className="font-mono-main text-[10px] text-ink/40">No guests yet.</p>}
        {guests.map((guest) => (
          <div key={guest.email} className="flex items-center gap-3 py-3 border-t border-ink/10">
            <Avatar name={guest.name || guest.email} photoUrl={guest.photoUrl} size={30} />
            <div className="min-w-0 flex-1">
              <p className="font-mono-main text-[12px] truncate text-ink">{guest.name || guest.email}</p>
              {guest.name && <p className="font-mono-main text-[9px] text-ink/40 truncate">{guest.email}</p>}
              {statuses[guest.email] && (
                <Chip tone={statuses[guest.email] === 'in' ? 'forest' : statuses[guest.email] === 'off' ? 'neutral' : 'sepia'} className="mt-1 !text-[10px]">{GUEST_STATUS_LABEL[statuses[guest.email]]}</Chip>
              )}
            </div>
            {/* Side by side, so a pressed one pushes its neighbour like every other button row. */}
            <div className="spring-group flex items-center gap-2 shrink-0">
              <Button size="sm" tone={guest.active ? 'ink' : 'outline'} disabled={busy} onClick={() => run(() => onSetActive(guest, !guest.active))}>
                {guest.active ? 'On' : 'Off'}
              </Button>
              <IconButton size="sm" tone="outline" aria-label={`Remove ${guest.email}`} data-tip="Remove" disabled={busy} onClick={() => run(() => onRemove(guest.email))}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    </AppModal>
  );
};

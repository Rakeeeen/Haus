import React, { useEffect, useRef, useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import { auth } from '@/data/firebase';
import { requestGuestCode, submitGuestCode } from '@/data/guestAccess';
import { formatCode, isCompleteCode, normalizeCode } from '@/domain/access';
import { Button } from '@/ui/Button';
import { Boil, SketchSvg } from '@/ui/Sketch';
import { LOCK_ICON } from '@/ui/sketchIcons.data';

type State = 'asking' | 'waiting' | 'wrong' | 'error';

const MESSAGE: Record<State, string> = {
  asking: 'Telling Hamed you’re here…',
  waiting: 'Hamed has been told. Ask him for the 8-digit code, then type it here.',
  wrong: 'That code didn’t work — it may have run out. Check it, or ask again for a new one.',
  error: 'Couldn’t reach Hamed. Check your connection and ask again.',
};

/**
 * What an invited guest sees until they have typed in a code. The fingerprint is Hamed's; a guest is let in
 * by a one-time code that shows up on Hamed's screen when they ask, and that he tells them. Whether the code
 * is right is decided by firestore.rules, not here — this only asks and submits.
 */
export const GuestCodeGate: React.FC<{ user: User }> = ({ user }) => {
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>('asking');
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);

  const ask = async () => {
    setState('asking');
    try {
      await requestGuestCode(user.uid, user.email ?? '', user.displayName);
      setState('waiting');
    } catch (error) {
      console.warn('Could not ask for a code:', error);
      setState('error');
    }
  };

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    ask();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCompleteCode(code) || busy) return;
    setBusy(true);
    try {
      await submitGuestCode(user.uid, normalizeCode(code));
      // Accepted: AuthProvider sees the approval and swaps this screen for the system.
    } catch {
      setState('wrong');
      setCode('');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md card p-10 md:p-12 text-center">
        <div className="flex justify-center mb-8 text-ink">
          <SketchSvg size={52}><Boil frames={LOCK_ICON.frames} /></SketchSvg>
        </div>
        <h1 className="text-silver mx-auto text-3xl font-black uppercase tracking-tight mb-4">Enter code</h1>
        <p className={`font-mono-main text-[11px] leading-relaxed mb-8 ${state === 'wrong' || state === 'error' ? 'text-rust' : 'text-ink/60'}`}>
          {MESSAGE[state]}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            value={formatCode(normalizeCode(code))}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="0000 0000"
            aria-label="8-digit code"
            className="w-full text-center font-mono-main text-3xl font-black tracking-[0.2em] outline-none bg-ink/5 border border-ink/12 focus:border-ink text-ink rounded-box px-4 py-4"
          />
          <Button type="submit" disabled={!isCompleteCode(code) || busy} className="w-full">
            {busy ? 'Checking…' : 'Enter'}
          </Button>
          <Button tone="ghost" onClick={ask} disabled={busy || state === 'asking'} className="w-full">Ask again</Button>
          <Button tone="outline" onClick={() => signOut(auth)} className="w-full">Sign out</Button>
        </form>
      </div>
    </div>
  );
};

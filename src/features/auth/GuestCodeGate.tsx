import React, { useEffect, useRef, useState } from 'react';
import { signOutUser, type AuthUser } from '@/data/auth';
import { requestGuestCode, submitGuestCode } from '@/data/guestAccess';
import { CODE_LENGTH, formatCode, normalizeCode } from '@/domain/access';
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
export const GuestCodeGate: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>('asking');
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);
  const field = useRef<HTMLInputElement>(null);

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

  // No button to press: the moment the eighth digit is in, the code is tried.
  const submit = async (digits: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await submitGuestCode(user.uid, digits);
      // Accepted: AuthProvider sees the approval and swaps this screen for the system.
    } catch (error) {
      // The rules refuse without saying why; the code in the error at least tells a wrong code from a network fault.
      console.warn('The code was refused:', (error as { code?: string }).code ?? error);
      setState('wrong');
      setCode('');
    }
    setBusy(false);
    // A disabled field loses focus; put it back so they can type again straight away.
    requestAnimationFrame(() => field.current?.focus());
  };

  const onType = (typed: string) => {
    const digits = normalizeCode(typed);
    setCode(digits);
    if (digits.length === CODE_LENGTH) submit(digits);
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

        <div className="flex flex-col gap-3">
          {/* Always left to right and plain digits, whatever language the keyboard is in. */}
          <input
            ref={field}
            value={formatCode(code)}
            onChange={(e) => onType(e.target.value)}
            dir="ltr"
            lang="en"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={busy}
            placeholder="0000 0000"
            aria-label="8-digit code"
            className="w-full text-center font-mono-main text-3xl font-black tracking-[0.2em] outline-none bg-ink/5 border border-ink/12 focus:border-ink text-ink rounded-box px-4 py-4 disabled:opacity-60"
          />
          <p className="font-mono-main text-[10px] text-ink/40 h-4">{busy ? 'Checking…' : ''}</p>
          <div className="spring-group flex gap-3">
            <Button tone="ghost" onClick={ask} disabled={busy || state === 'asking'} className="flex-1">Ask again</Button>
            <Button tone="outline" onClick={() => signOutUser()} className="flex-1">Sign out</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

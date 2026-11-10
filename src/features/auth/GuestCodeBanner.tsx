import React, { useEffect, useState } from 'react';
import { useGuestCodes } from '@/data/guestAccess';
import { formatCode, secondsLeft } from '@/domain/access';
import { Button } from '@/ui/Button';

/**
 * Hamed's side of letting a guest in: when an invited guest signs in and asks, their one-time code appears
 * here (bottom left). He tells it to them; it runs out after five minutes. Mounted for the owner only.
 */
export const GuestCodeBanner: React.FC = () => {
  const { codes, dismiss } = useGuestCodes(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const live = codes.filter((c) => secondsLeft(c.expiresAt, now) > 0);
  if (live.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-3">
      {live.map((c) => {
        const left = secondsLeft(c.expiresAt, now);
        return (
          <div key={c.uid} className="card p-6 w-72 text-left" style={{ borderColor: 'var(--sepia)' }}>
            <p className="font-mono-main text-[10px] uppercase tracking-widest text-ink/50 mb-1 truncate">
              {c.name || c.email} wants in
            </p>
            <p className="font-black text-3xl tracking-[0.12em] text-ink mb-3 font-mono-main">{formatCode(c.code)}</p>
            <div className="flex items-center justify-between">
              <p className="font-mono-main text-[10px] text-ink/40">
                Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </p>
              <Button size="sm" tone="ghost" onClick={() => dismiss(c.uid)}>Hide</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

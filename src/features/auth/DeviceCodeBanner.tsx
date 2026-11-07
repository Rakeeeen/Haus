import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onDeviceCodeRequest, generateAndStoreCode, DeviceAuthDoc } from '@/data/deviceAuth';

interface Props {
  user: User;
}

export const DeviceCodeBanner: React.FC<Props> = ({ user }) => {
  const [request, setRequest] = useState<DeviceAuthDoc | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const unsub = onDeviceCodeRequest(user.uid, async (data) => {
      if (!data || !data.pending) {
        setRequest(null);
        setCode(null);
        return;
      }
      setRequest(data);
      // If Mac hasn't generated a code yet, generate it now
      if (!data.code) {
        const generated = await generateAndStoreCode(user.uid);
        setCode(generated);
      } else {
        setCode(data.code);
      }
    });
    return () => unsub();
  }, [user.uid]);

  // Countdown timer
  useEffect(() => {
    if (!request) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) { setRequest(null); setCode(null); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [request]);

  if (!request || !code) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div
      className="fixed bottom-6 right-6 z-50 card p-6 w-72 text-left"
      style={{ borderColor: 'var(--rust)' }}
    >
      <p className="font-mono-main text-[10px] uppercase tracking-widest text-ink/50 mb-2">
        New device registration
      </p>
      <p className="font-black text-4xl tracking-[0.15em] text-ink mb-3 font-mono-main">
        {code}
      </p>
      <p className="font-mono-main text-[10px] text-ink/40">
        Expires in {mins}:{secs}
      </p>
    </div>
  );
};

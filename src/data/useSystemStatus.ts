import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/data/firebase';
import { MAX_PAUSE_MESSAGE, pauseOf, type SystemPause } from '@/domain/pause';

const STATUS = doc(db, 'system', 'status');

/**
 * Whether Haus is paused for guests (one document that everyone watches), and Hamed's switch for it. `listen` is false when
 * nobody needs it (signed out, or the owner on a screen without the switch). If the document can't be read the answer is "not
 * paused": a broken connection must never lock people out of their own system.
 */
export function useSystemStatus(listen: boolean) {
  const [pause, setPause] = useState<SystemPause>({ paused: false, message: '' });

  useEffect(() => {
    if (!listen) return;
    return onSnapshot(
      STATUS,
      (snap) => setPause(pauseOf(snap.exists() ? snap.data() : null)),
      (error) => { console.warn('Could not read the pause switch:', error.message); setPause({ paused: false, message: '' }); },
    );
  }, [listen]);

  /** Hamed only (the rules refuse anyone else). `message` is shown to guests while it is paused. */
  const setPaused = useCallback(async (paused: boolean, message = '') => {
    await setDoc(STATUS, { paused, message: message.trim().slice(0, MAX_PAUSE_MESSAGE), updatedAt: new Date().toISOString() });
  }, []);

  return { ...pause, setPaused };
}

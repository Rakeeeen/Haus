import { useEffect } from 'react';
import { logActivity } from '@/data/activityLog';
import { enteredText } from '@/domain/activity';

const FLAG = 'haus_entered_logged';

/** Remembers, for this browser tab, that coming in has been logged (so the code screen and this don't both log it). */
export function markEntered(): void {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* no storage: at worst it is logged twice */ }
}

/**
 * Logs that a guest opened Haus — once per visit (a tab), so a refresh is not a new entry. Typing the code on the code
 * screen counts as the visit's entry, and is logged there. Renders nothing; mounted for guests who are in.
 */
export const GuestEntered: React.FC<{ uid: string; name: string }> = ({ uid, name }) => {
  useEffect(() => {
    try { if (sessionStorage.getItem(FLAG)) return; } catch { /* log it */ }
    markEntered();
    void logActivity({ uid, name, type: 'entered', text: enteredText(false) });
  }, [uid, name]);
  return null;
};

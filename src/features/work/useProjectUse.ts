import { useCallback, useRef } from 'react';
import { useStoredState } from '@/lib/useStoredState';
import { isProjectUse, noteUse, type ProjectUse } from '@/domain/work/recentProjects';

/**
 * Which projects are used most and last on this device — read to order the project lists and dropdowns, written when a
 * project is chosen or opened. Kept in this browser only: it is a convenience, not data. `markUsed` keeps one identity, so
 * it can sit in an effect without re-running it.
 */
export function useProjectUse(): { use: ProjectUse; markUsed: (...ids: string[]) => void } {
  const [use, setUse] = useStoredState<ProjectUse>('work_project_use', {}, isProjectUse);
  const latest = useRef(use);
  latest.current = use;
  const markUsed = useCallback((...ids: string[]) => {
    if (ids.length === 0) return;
    const now = Date.now();
    let next = latest.current;
    ids.forEach((id, i) => { next = noteUse(next, id, now - i); });
    latest.current = next;
    setUse(next);
  }, [setUse]);
  return { use, markUsed };
}

/**
 * Runs the loaders one after another, each when the browser has nothing better to do, so a page's code is already on the
 * device by the time it is opened. Nothing here is awaited by anyone: a loader that fails is skipped (the page simply loads
 * when it is opened, as it always did), and on a connection that asks to save data nothing is fetched ahead.
 */
type Idle = (run: () => void) => void;

const browserIdle: Idle = (run) => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => run(), { timeout: 4000 });
  else setTimeout(run, 300);
};

const savesData = (): boolean => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

export function preloadWhenIdle(loaders: ReadonlyArray<() => Promise<unknown>>, idle: Idle = browserIdle, skip: () => boolean = savesData): void {
  if (skip()) return;
  const queue = [...loaders];
  const next = () => {
    const load = queue.shift();
    if (!load) return;
    idle(() => { load().catch(() => undefined).finally(next); });
  };
  next();
}

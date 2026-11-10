import taskDoneUrl from '@/assets/sounds/task-done.wav';

/**
 * The system's one sound: the small, warm rising chime a finished task makes (rendered by scripts/sound/build_task_done.py —
 * its header says why it sounds the way it does). Played on top of a modest volume so it confirms, never startles. Browsers
 * allow sound only after a click or a key, and finishing a task is one, so it needs no unlocking. Failing to play (no
 * audio, a blocked page) is silent: the task is done either way.
 */
const VOLUME = 0.5;
let loaded: HTMLAudioElement | null = null;

export function playTaskDone(): void {
  try {
    if (window.localStorage.getItem('haus_sound') === 'off') return;
  } catch { /* no storage: sound stays on */ }
  try {
    loaded ??= Object.assign(new Audio(taskDoneUrl), { preload: 'auto' });
    // A copy, so finishing two tasks quickly lets the first ring on instead of cutting it off.
    const voice = loaded.cloneNode(true) as HTMLAudioElement;
    voice.volume = VOLUME;
    void voice.play().catch(() => { /* blocked or unavailable */ });
  } catch { /* no audio */ }
}

/** Hamed can pause Haus for everyone (guests) for a while, with a few words about why. The state is one document, `system/status`. */
export interface SystemPause {
  paused: boolean;
  /** What guests are told while it is paused (may be empty). */
  message: string;
}

/** The longest message (firestore.rules refuses a longer one). */
export const MAX_PAUSE_MESSAGE = 200;

/** The pause state from whatever the document holds (nothing, or something odd, means not paused). */
export function pauseOf(data: { paused?: unknown; message?: unknown } | null | undefined): SystemPause {
  return {
    paused: data?.paused === true,
    message: typeof data?.message === 'string' ? data.message.trim().slice(0, MAX_PAUSE_MESSAGE) : '',
  };
}

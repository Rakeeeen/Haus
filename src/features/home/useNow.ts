import { useEffect, useState } from 'react';

/**
 * The current time for a screen that works in minutes (clocks, prayer locks, the greeting) or in tens of seconds (a timer that
 * takes over after minutes, a card pick that holds for 30 s). It is a new value only when the minute turns or five seconds
 * have passed — returning the same value is not a render, and a big screen re-rendering every second is felt.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow((prev) => {
      const next = new Date();
      return next.getMinutes() !== prev.getMinutes() || next.getTime() - prev.getTime() >= 5000 ? next : prev;
    }), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

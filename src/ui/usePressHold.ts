import { useEffect } from 'react';
import { MIN_PRESS_MS } from '@/ui/springPose';

const PRESSABLE = '.btn:not(:disabled), .spring-group > button:not(:disabled)';

/**
 * Marks the pressed button with `data-pressed` for at least MIN_PRESS_MS. A real click is over
 * in well under the spring's time, so CSS `:active` alone would end before the push can show.
 * Mounted once for the whole app; global.css does the moving.
 */
export function usePressHold() {
  useEffect(() => {
    let pressed: Element | null = null;
    let pressedAt = 0;

    const down = (e: PointerEvent) => {
      pressed = e.target instanceof Element ? e.target.closest(PRESSABLE) : null;
      pressedAt = Date.now();
      pressed?.setAttribute('data-pressed', '');
    };
    const up = () => {
      const button = pressed;
      pressed = null;
      if (!button) return;
      window.setTimeout(
        () => button.removeAttribute('data-pressed'),
        Math.max(0, MIN_PRESS_MS - (Date.now() - pressedAt)),
      );
    };

    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, []);
}

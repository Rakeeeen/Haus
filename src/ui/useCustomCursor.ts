import React, { useEffect } from 'react';
import { MIN_PRESS_MS } from '@/ui/springPose';

export const useCustomCursor = (cursorRef: React.RefObject<HTMLDivElement>): void => {
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    let mouseX = -999;
    let mouseY = -999;
    let isHovered = false;
    let visible = false;
    let frameId = 0;

    // Hide until first real mousemove
    el.style.opacity = '0';

    // The pointer is drawn once per frame, and only when it moved — not every frame while the mouse
    // sits still. What it does over a clickable thing (tilt) and when pressed (a squeeze) is CSS
    // on the arrow itself (global.css, .custom-cursor-svg), on the system's spring, so the
    // position follows the mouse exactly while only the arrow has weight.
    const draw = () => {
      frameId = 0;
      el.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    };
    const schedule = () => { if (!frameId) frameId = requestAnimationFrame(draw); };

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) {
        visible = true;
        el.style.opacity = '1';
      }
      schedule();
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const hovered = !!(
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('a') ||
        target.closest('button') ||
        target.classList.contains('cursor-pointer') ||
        target.closest('.cursor-pointer')
      );
      if (hovered !== isHovered) {
        isHovered = hovered;
        el.toggleAttribute('data-hover', hovered);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseover', handleMouseOver);

    // A press is held at least MIN_PRESS_MS, so a quick click still shows (as in usePressHold).
    let pressedAt = 0;
    const onDown = () => { pressedAt = Date.now(); el.setAttribute('data-pressed', ''); };
    const onUp = () => {
      window.setTimeout(() => el.removeAttribute('data-pressed'), Math.max(0, MIN_PRESS_MS - (Date.now() - pressedAt)));
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(frameId);
    };
  }, [cursorRef]);

};

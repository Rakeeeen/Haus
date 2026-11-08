import React, { useEffect } from 'react';

export const useCustomCursor = (cursorRef: React.RefObject<HTMLDivElement>) => {
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

    // The pointer is drawn once per frame, and only when it moved or changed what it is over —
    // not every frame while the mouse sits still.
    const draw = () => {
      frameId = 0;
      el.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) scale(${isHovered ? 1.15 : 1})`;
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
      if (hovered !== isHovered) { isHovered = hovered; schedule(); }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(frameId);
    };
  }, [cursorRef]);

  return {};
};

import React, { useEffect } from 'react';

export const useCustomCursor = (cursorRef: React.RefObject<HTMLDivElement>) => {
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    let mouseX = -999;
    let mouseY = -999;
    let isHovered = false;
    let visible = false;
    let frameId: number;

    // Hide until first real mousemove
    el.style.opacity = '0';

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) {
        visible = true;
        el.style.opacity = '1';
      }
    };

    const updatePosition = () => {
      el.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) scale(${isHovered ? 1.15 : 1})`;
      frameId = requestAnimationFrame(updatePosition);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      isHovered = !!(
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
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    frameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(frameId);
    };
  }, [cursorRef]);

  return {};
};

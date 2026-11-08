import React, { useEffect } from 'react';
import { SPRING } from '@/ui/springPose';

const CLICKABLE = 'a, button, input, textarea, select, .cursor-pointer';

/** Where the paper settles behind the line, in px: resting, over something clickable, pressed. */
const PAPER_OFFSET = { rest: 3, lift: 6, pressed: 0 };

/**
 * Moves the pointer's line with the mouse exactly, and its paper on the system's spring (the same
 * stiffness and damping as SPRING), so the paper lags a moving pointer and settles back under it.
 */
export const useCustomCursor = (
  lineRef: React.RefObject<HTMLDivElement>,
  paperRef: React.RefObject<HTMLDivElement>,
) => {
  useEffect(() => {
    const line = lineRef.current;
    const paper = paperRef.current;
    if (!line || !paper) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let mouseX = -999, mouseY = -999;
    let offset = PAPER_OFFSET.rest;
    let px = mouseX, py = mouseY, vx = 0, vy = 0;
    let visible = false;
    let last = performance.now();
    let frameId = 0;

    line.style.opacity = '0';
    paper.style.opacity = '0';

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX; mouseY = e.clientY;
      if (!visible) {
        visible = true; px = mouseX; py = mouseY;
        line.style.opacity = '1'; paper.style.opacity = '1';
      }
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (offset !== PAPER_OFFSET.pressed) offset = t?.closest?.(CLICKABLE) ? PAPER_OFFSET.lift : PAPER_OFFSET.rest;
    };
    const onDown = () => { offset = PAPER_OFFSET.pressed; };
    const onUp = (e: MouseEvent) => {
      const t = e.target as Element | null;
      offset = t?.closest?.(CLICKABLE) ? PAPER_OFFSET.lift : PAPER_OFFSET.rest;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const tx = mouseX + offset, ty = mouseY + offset;
      if (still) {
        px = tx; py = ty;
      } else {
        // Semi-implicit Euler on a damped spring, mass 1.
        vx += (SPRING.stiffness * (tx - px) - SPRING.damping * vx) * dt;
        vy += (SPRING.stiffness * (ty - py) - SPRING.damping * vy) * dt;
        px += vx * dt; py += vy * dt;
      }
      line.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      paper.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      frameId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    frameId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(frameId);
    };
  }, [lineRef, paperRef]);
};

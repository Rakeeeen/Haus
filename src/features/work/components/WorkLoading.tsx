import React from 'react';
import { Boil, SketchSvg } from '@/ui/Sketch';
import { TASKS_ICON } from '@/ui/sketchIcons.data';

/** What the work screens show while their data arrives: the Tasks drawing, redrawn by hand again and again. */
export const WorkLoading: React.FC = () => (
  <div className="flex flex-col items-center gap-4 py-16 text-ink/70" role="status" aria-label="Loading">
    <SketchSvg size={72}><Boil frames={TASKS_ICON.frames} /></SketchSvg>
    <span className="font-mono-main text-[12px] uppercase tracking-[0.25em] text-ink/40">Loading</span>
  </div>
);

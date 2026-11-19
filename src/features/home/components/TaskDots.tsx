import React from 'react';
import type { TaskProgress } from '@/domain/work/progress';

/** More dots than this stop being a glance; the rest are counted. */
const MAX_DOTS = 10;

type Kind = 'carried' | 'open' | 'done';

const DOT: Record<Kind, string> = {
  // Waiting from before: faint and hollow, so they are there without pulling at the eye.
  carried: 'border border-ink/25',
  open: 'border border-ink/55',
  done: 'border border-ink bg-ink',
};

/**
 * The Tasks card's counter, drawn as dots instead of a number: one for each task from before (faint, hollow), then one for each
 * of today's — hollow while it is open, filled once it is done. Finishing one just fills its dot. No words, no red: it is a
 * quiet picture of how the day is going. Its height is the number's, so the card doesn't change shape.
 */
export const TaskDots: React.FC<{ progress: TaskProgress }> = ({ progress }) => {
  const dots: Kind[] = [
    ...Array<Kind>(progress.carried).fill('carried'),
    ...Array<Kind>(progress.done).fill('done'),
    ...Array<Kind>(progress.open).fill('open'),
  ];
  if (dots.length === 0) return <span className="font-mono-main text-[16px] lg:text-[18px] font-black block h-6 lg:h-[27px] leading-6 lg:leading-[27px] text-ink/30">—</span>;
  const shown = dots.slice(0, MAX_DOTS);
  const extra = dots.length - shown.length;
  return (
    <span
      className="flex items-center gap-1 h-6 lg:h-[27px]"
      role="img"
      aria-label={`${progress.done} done, ${progress.open} left today${progress.carried ? `, ${progress.carried} from before` : ''}`}
    >
      {shown.map((kind, i) => (
        <span key={i} className={`block w-2 h-2 rounded-full transition-[background-color,border-color] duration-500 ease-out ${DOT[kind]}`} />
      ))}
      {extra > 0 && <span className="font-mono-main text-[8px] font-bold text-ink/40 leading-none ml-0.5">+{extra}</span>}
    </span>
  );
};

import React from 'react';
import { ICON_STROKE_LINECAP, ICON_STROKE_LINEJOIN, ICON_STROKE_WIDTH } from '@/ui/icons';

/**
 * "Haus" in plain Latin letters, vocalised the way classical Arabic is written: a fatha on the H
 * (Ha-), a sukun on the u (-au-), a sukun on the s — هَاوْسْ. The marks are drawn,
 * not typed, so they sit the same way in every font and in the PDF (see `backend/src/features/report/render.js`,
 * which draws the same shapes).
 */
const LETTERS: ReadonlyArray<{ letter: string; mark?: { kind: MarkKind; side: 'above' | 'below' } }> = [
  { letter: 'H', mark: { kind: 'fatha', side: 'above' } },
  { letter: 'a' },
  { letter: 'u', mark: { kind: 'sukun', side: 'above' } },
  { letter: 's', mark: { kind: 'sukun', side: 'above' } },
];

type MarkKind = 'fatha' | 'sukun';

/** Each mark on a 24 × 24 grid, centred horizontally. */
const MARK_SHAPES: Record<MarkKind, React.ReactNode> = {
  // a short slanted stroke, above the letter
  fatha: <path d="M6 16 L18 8" />,
  // an open ring
  sukun: <circle cx="12" cy="12" r="5.5" />,
};

const Mark: React.FC<{ kind: MarkKind; side: 'above' | 'below' }> = ({ kind, side }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth={ICON_STROKE_WIDTH}
    strokeLinecap={ICON_STROKE_LINECAP}
    strokeLinejoin={ICON_STROKE_LINEJOIN}
    className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
    style={{ width: '0.74em', height: '0.74em', ...(side === 'above' ? { top: '-0.27em' } : { bottom: '-0.36em' }) }}
  >
    {MARK_SHAPES[kind]}
  </svg>
);

/** The system's name. Size and colour come from the surrounding text (`className` / `currentColor`). */
export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    role="img"
    aria-label="Haus"
    className={`inline-flex items-baseline select-none ${className}`}
    // room for the marks above and below the letters
    style={{ gap: '0.14em', paddingTop: '0.5em', paddingBottom: '0.44em' }}
  >
    {LETTERS.map(({ letter, mark }, index) => (
      <span key={index} aria-hidden className="relative inline-block leading-none">
        {letter}
        {mark && <Mark kind={mark.kind} side={mark.side} />}
      </span>
    ))}
  </span>
);

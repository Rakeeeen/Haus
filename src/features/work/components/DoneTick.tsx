import React from 'react';

/** The small round tick that finishes (or reopens) a task. */
export const DoneTick: React.FC<{ done: boolean; onToggle: () => void }> = ({ done, onToggle }) => (
  <button
    type="button"
    aria-label={done ? 'Mark as not done' : 'Mark as done'}
    data-tip={done ? 'Reopen' : 'Done'}
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    onPointerDown={(e) => e.stopPropagation()}
    className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${done ? 'bg-ink/70 border-ink/70 text-paper' : 'border-ink/30 hover:border-ink text-transparent hover:text-ink/40'}`}
  >
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.3 4.2 7.5 8 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>
);

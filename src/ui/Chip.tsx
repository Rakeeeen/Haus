import React from 'react';

/** A small label: a status, a priority, a tag. Colour only says how much it asks for attention; nothing here is interactive. */
export type ChipTone = 'neutral' | 'ink' | 'sepia' | 'forest' | 'rust';

const TONE: Record<ChipTone, string> = {
  neutral: 'text-ink/55 bg-ink/8',
  ink: 'text-paper bg-ink',
  sepia: 'text-white bg-sepia',
  forest: 'text-forest bg-forest/12',
  rust: 'text-rust bg-rust/12',
};

export const Chip: React.FC<{ tone?: ChipTone; children: React.ReactNode; className?: string }> = ({ tone = 'neutral', children, className = '' }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono-main text-[9px] font-bold uppercase tracking-[0.15em] leading-none whitespace-nowrap ${TONE[tone]} ${className}`}>
    {children}
  </span>
);

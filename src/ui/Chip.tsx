import React from 'react';

/** A small label: a status, a priority, a tag. Colour only says how much it asks for attention; nothing here is interactive. */
export type ChipTone = 'neutral' | 'ink' | 'sepia' | 'forest' | 'rust';

const TONE: Record<ChipTone, string> = {
  neutral: 'text-ink/55 bg-ink/6',
  ink: 'text-ink/75 border border-ink/25',
  sepia: 'text-sepia bg-sepia/10',
  forest: 'text-forest bg-forest/10',
  rust: 'text-rust bg-rust/10',
};

export const Chip: React.FC<{ tone?: ChipTone; children: React.ReactNode; className?: string }> = ({ tone = 'neutral', children, className = '' }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono-main text-[12px] font-semibold uppercase tracking-[0.08em] leading-[1.7] whitespace-nowrap ${TONE[tone]} ${className}`}>
    {children}
  </span>
);

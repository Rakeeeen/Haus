import React from 'react';
import { NAME } from '@/constants/brand';

/** The system's name, plain. Size and colour come from the surrounding text (`className` / `currentColor`). */
export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`select-none ${className}`}>{NAME}</span>
);

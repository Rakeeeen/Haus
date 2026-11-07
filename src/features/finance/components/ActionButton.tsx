import React from 'react';
import { Button } from '@/ui/Button';

/** Finance's actions (Deposit, Withdraw, Add…). `solid` is the main one on a screen. */
export const ActionButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'solid' | 'ghost' }> = ({
  tone = 'ghost', ...props
}) => <Button tone={tone === 'solid' ? 'ink' : 'outline'} size="sm" {...props} />;

import React from 'react';

/**
 * The only two buttons in the system, both fully round. Hovering changes their colour and
 * nothing else: no lift, no scale, no shadow. The look itself lives in global.css (.btn-*).
 *
 * `primary` is the one purple action on a screen; keep it rare. `ink` is a strong action that
 * isn't that one, `outline` is everything else, `ghost` is the quietest, and `danger` is for
 * something that takes money out or can't be undone.
 */
type Tone = 'primary' | 'ink' | 'outline' | 'ghost' | 'danger';

type NativeButton = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button: React.FC<NativeButton & { tone?: Tone; size?: 'sm' | 'md' }> = ({
  tone = 'primary', size = 'md', type = 'button', className = '', ...props
}) => (
  <button type={type} {...props} className={`btn btn-${tone} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} />
);

/** Icon only, so it has to say what it does: `aria-label` is required. */
export const IconButton: React.FC<NativeButton & { tone?: Tone; size?: 'sm' | 'md' | 'lg'; 'aria-label': string }> = ({
  tone = 'outline', size = 'md', type = 'button', className = '', ...props
}) => (
  <button type={type} {...props} className={`btn btn-icon-${size} btn-${tone} ${className}`} />
);

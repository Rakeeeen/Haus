import React from 'react';

/** A person's round photo, or their first letter when there is no photo. */
export const Avatar: React.FC<{ name: string; photoUrl?: string | null; size?: number; className?: string }> = ({ name, photoUrl, size = 20, className = '' }) => {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.5) };
  return photoUrl ? (
    <img src={photoUrl} alt="" referrerPolicy="no-referrer" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span style={style} className={`shrink-0 rounded-full bg-ink/10 text-ink/60 flex items-center justify-center font-sans-main font-bold uppercase ${className}`} aria-hidden>
      {name.trim().charAt(0) || '?'}
    </span>
  );
};

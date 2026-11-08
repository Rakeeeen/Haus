import React from 'react';

/** The PRIVATE / VISIBLE switch that hides or shows every amount on the Finance page.
 *  `disabled` is for tabs (Thndr) that don't honor it — their numbers are always on
 *  screen, so flipping the switch there would do nothing. */
export const PrivacyToggle: React.FC<{ privateMode: boolean; onToggle: () => void; disabled?: boolean }> = ({ privateMode, onToggle, disabled = false }) => (
  <button
    onClick={disabled ? undefined : onToggle}
    disabled={disabled}
    className={`flex items-center gap-2 select-none group ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    data-tip={disabled ? "Always visible here" : privateMode ? 'Privacy on' : 'Privacy off'}
  >
    <span className="font-mono-main text-[9px] uppercase tracking-widest text-ink/40 group-hover:text-ink/60 transition-colors">
      {privateMode ? 'PRIVATE' : 'VISIBLE'}
    </span>
    {/* A metal toggle, the retro touch: an aluminum knob that throws across on the system's spring. */}
    <div className={`relative w-9 h-5 border rounded-full transition-colors duration-200 ${privateMode ? 'border-ink bg-ink/10' : 'border-ink/30'}`}>
      <div
        className="metal-knob absolute top-0.5 w-3.5 h-3.5 rounded-full"
        style={{ left: privateMode ? 'calc(100% - 0.875rem - 2px)' : '2px' }}
      />
    </div>
  </button>
);

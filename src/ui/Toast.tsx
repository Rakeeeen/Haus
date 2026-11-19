import React from 'react';
import { motion } from 'framer-motion';
import { SPRING } from '@/ui/springPose';

/**
 * The small card that rises at the bottom for a moment: an icon (hand-drawn, with its own little motion), a heading, what it is
 * about, and — where there is one — a button. A thin line along its foot runs down with the time it has left. The caller puts it
 * in an AnimatePresence and keys it, so a new one replaces the old.
 */
export const Toast: React.FC<{
  icon: React.ReactNode;
  caption: string;
  text: string;
  /** Dimmed, for "nothing to do" and failures. */
  dim?: boolean;
  action?: { label: string; hint?: string; onClick: () => void };
  /** How long it stays, for the line along its foot; omit for none. */
  ms?: number;
}> = ({ icon, caption, text, dim = false, action, ms }) => (
  <div className="fixed inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] z-[10001] flex justify-center px-4 pointer-events-none">
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
      transition={{ ...SPRING, opacity: { duration: 0.18 } }}
      className="pointer-events-auto relative flex items-center gap-3.5 min-w-[260px] max-w-[min(92vw,440px)] pl-2.5 pr-5 py-2.5 rounded-card bg-paper-dark border border-ink/14 text-ink shadow-[0_18px_48px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.08)] overflow-hidden"
    >
      <span className="shrink-0 grid place-items-center w-12 h-12 rounded-full bg-ink/5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono-main text-[10px] font-bold uppercase tracking-[0.22em] text-ink/40">{caption}</span>
        <span dir="auto" className={`block font-sans-main text-[15px] font-semibold leading-snug truncate ${dim ? 'text-ink/50' : ''}`}>{text}</span>
      </span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 -mr-2 rounded-full px-4 py-2 font-mono-main text-[11px] font-bold uppercase tracking-[0.18em] bg-ink text-paper hover:opacity-85 transition-opacity cursor-pointer"
        >
          {action.label}{action.hint && <span className="ml-2 opacity-50 normal-case tracking-normal font-medium">{action.hint}</span>}
        </button>
      )}
      {ms !== undefined && (
        <motion.span
          aria-hidden
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: ms / 1000, ease: 'linear' }}
          className="absolute left-0 right-0 bottom-0 h-[2px] bg-ink/20 origin-left"
        />
      )}
    </motion.div>
  </div>
);

/** An icon that swings into place when it appears — back for undo (`from` negative), forward for redo — on the system's spring. */
export const SwingIn: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => (
  <motion.span
    initial={{ rotate: from, scale: 0.7, opacity: 0 }}
    animate={{ rotate: 0, scale: 1, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 260, damping: 15, mass: 0.9, opacity: { duration: 0.15 } }}
    className="grid place-items-center"
  >
    {children}
  </motion.span>
);

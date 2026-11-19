import React, { useEffect, useId, useRef } from 'react';
import { Button } from '@/ui/Button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { useBodyScrollLock } from '@/ui/useBodyScrollLock';
import { AutoHeight } from '@/ui/AutoHeight';

const PRESSABLE = 'button, a, [role="button"], [role="tab"], [data-origin]';

/**
 * What was pressed last, remembered at the press (Safari doesn't focus a clicked button, and by the time a dialog opens the
 * pointer may be elsewhere). `el` is kept, not only where it was: a word or a button can move (a greeting that changes, a list
 * that re-sorts), and the dialog should come out of — and go back into — where it is *now*. `fixed` is for a big thing (a task's
 * card, a row), which the dialog comes out of at the spot that was pressed on it, not at its middle.
 */
interface Press { el: Element | null; x: number; y: number; fixed: boolean; at: number }
let lastPress: Press | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest?.(PRESSABLE) ?? null;
    if (!el) { lastPress = { el: null, x: e.clientX, y: e.clientY, fixed: true, at: Date.now() }; return; }
    const r = el.getBoundingClientRect();
    const fixed = r.width > 260 || r.height > 110;
    lastPress = { el, x: fixed ? e.clientX : r.left + r.width / 2, y: fixed ? e.clientY : r.top + r.height / 2, fixed, at: Date.now() };
  }, true);
}

/** The control that opened the dialog: the one just pressed, or — opened from the keyboard — the one with focus. */
function pickTrigger(): Press | null {
  if (lastPress && Date.now() - lastPress.at < 1500) return lastPress;
  const el = document.activeElement;
  if (el && el !== document.body && el.matches?.(PRESSABLE)) {
    const r = el.getBoundingClientRect();
    return { el, x: r.left + r.width / 2, y: r.top + r.height / 2, fixed: false, at: Date.now() };
  }
  return null;
}

/** Where the trigger is now: the middle of its element if that is still on the page, else where it was. */
function livePoint(t: Press): { x: number; y: number } {
  if (!t.fixed && t.el?.isConnected) {
    const r = t.el.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: t.x, y: t.y };
}

/** Where the dialog starts (and returns to), as an offset from the middle of the window where it sits. */
type Origin = { x: number; y: number } | null;
const originOf = (t: Press | null, still: boolean): Origin => {
  if (!t || still) return null;
  const p = livePoint(t);
  return { x: p.x - window.innerWidth / 2, y: p.y - window.innerHeight / 2 };
};

interface DialogMotion { from: Origin; still: boolean }
const EXIT_EASE = [0.23, 1, 0.32, 1] as const;
/** Comes out of what opened it, small, and settles in the middle; goes back the same way. */
const DIALOG_VARIANTS = {
  initial: ({ from, still }: DialogMotion) => ({ x: from?.x ?? 0, y: from ? from.y : still ? 0 : 18, scale: from ? 0.4 : still ? 1 : 0.93, opacity: 0 }),
  animate: { x: 0, y: 0, scale: 1, opacity: 1 },
  exit: ({ from, still }: DialogMotion) => ({
    x: from?.x ?? 0, y: from ? from.y : 0, scale: from ? 0.4 : still ? 1 : 0.95, opacity: 0, transition: { duration: 0.22, ease: EXIT_EASE },
  }),
};

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  maxWidth?: string;
  /** Skip the content wrapper padding — use when children manage their own layout */
  raw?: boolean;
  /** Confirm-dialog mode: shows two action buttons instead of ESC */
  confirm?: {
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    variant?: 'warning' | 'info';
  };
}

/**
 * The system's one dialog: a card over a dimmed, blurred page. It closes on Escape (its "ESC" button says so), on a click
 * outside the card, or on its button; the page behind it doesn't scroll; focus moves into it when it opens and goes back to
 * where it was when it closes. Popovers inside it (dropdowns, the calendar) take Escape first and close alone.
 */
export const AppModal: React.FC<AppModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  raw = false,
  confirm,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  // What the dialog comes out of and goes back into (null: from the middle, as before). Picked once per opening.
  const trigger = useRef<Press | null>(null);
  const wasOpen = useRef(false);
  if (isOpen && !wasOpen.current) trigger.current = pickTrigger();
  wasOpen.current = isOpen;

  // Read afresh on every render, so a trigger that has moved is found where it is now — including on the render that closes the
  // dialog, which is the one the exit animation uses (through `custom`, below).
  const motionOf: DialogMotion = { from: originOf(trigger.current, !!still), still: !!still };
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const before = document.activeElement as HTMLElement | null;
    // Unless something inside has already taken focus (an autofocused field), the dialog itself gets it.
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [isOpen]);

  return (
    <AnimatePresence custom={motionOf}>
      {isOpen && (
        <motion.div
          key="app-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(18px)' }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            // Comes out of what opened it, small, and settles in the middle; goes back the same way.
            custom={motionOf}
            variants={DIALOG_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ ...SPRING, opacity: { duration: 0.2 } }}
            onClick={e => e.stopPropagation()}
            className={`relative w-full rounded-modal outline-none ${maxWidth}`}
            style={{
              background: 'var(--paper-dark)',
              border: '1px solid color-mix(in srgb, var(--ink) 12%, transparent)',
            }}
          >
            {/* Header */}
            {(title || !confirm) && (
              <div
                className="flex items-center justify-between px-8 pt-8 pb-7"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
              >
                {title && (
                  <span
                    id={titleId}
                    className="font-sans-main font-black uppercase tracking-wide"
                    style={{ fontSize: 13, color: 'var(--ink)' }}
                  >
                    {title}
                  </span>
                )}
                <Button tone="outline" size="sm" onClick={onClose} className="ml-auto">
                  ESC
                </Button>
              </div>
            )}

            {/* Confirm mode */}
            {confirm ? (
              <div className="px-8 py-8">
                {title && (
                  <p
                    id={titleId}
                    className="font-sans-main font-black uppercase tracking-wide mb-3"
                    style={{ fontSize: 14, color: 'var(--ink)' }}
                  >
                    {title}
                  </p>
                )}
                <p
                  className="font-mono-main leading-relaxed mb-8"
                  style={{ fontSize: 12, color: 'color-mix(in srgb, var(--ink) 55%, transparent)' }}
                >
                  {confirm.message}
                </p>
                <div className="spring-group flex gap-3 justify-end">
                  <Button tone="outline" size="sm" onClick={onClose}>
                    {confirm.cancelText ?? 'Cancel'}
                  </Button>
                  <Button
                    tone={confirm.variant === 'info' ? 'primary' : 'danger'}
                    size="sm"
                    onClick={() => { confirm.onConfirm(); onClose(); }}
                  >
                    {confirm.confirmText ?? 'Confirm'}
                  </Button>
                </div>
              </div>
            ) : raw ? (
              <AutoHeight>{children}</AutoHeight>
            ) : (
              /* Content mode */
              <AutoHeight><div className="px-8 pb-8 pt-6">{children}</div></AutoHeight>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/ui/Button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { useBodyScrollLock } from '@/ui/useBodyScrollLock';
import { AutoHeight } from '@/ui/AutoHeight';

const PRESSABLE = 'button, a, [role="button"], [role="tab"]';

/** Where the control that was just pressed is, remembered at the press (Safari doesn't focus a clicked button), for a moment. */
let lastPress: { x: number; y: number; at: number } | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest?.(PRESSABLE);
    if (!el) { lastPress = null; return; }
    const r = el.getBoundingClientRect();
    lastPress = { x: r.left + r.width / 2, y: r.top + r.height / 2, at: Date.now() };
  }, true);
}

/** The centre of the control that opened the dialog: the one just pressed, or — opened from the keyboard — the one with focus. */
function triggerPoint(): { x: number; y: number } | null {
  if (lastPress && Date.now() - lastPress.at < 1500) return lastPress;
  const el = document.activeElement;
  if (el && el !== document.body && el.matches?.(PRESSABLE)) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return null;
}

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
  // The point the dialog grows from and shrinks back to, in its own coordinates (null: from the middle, as before).
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const trigger = useRef<{ x: number; y: number } | null>(null);
  const wasOpen = useRef(false);
  if (isOpen && !wasOpen.current) trigger.current = triggerPoint();
  wasOpen.current = isOpen;

  // Once laid out (its untransformed position, which a scale doesn't move), the trigger becomes a point inside the dialog.
  useLayoutEffect(() => {
    const el = dialogRef.current;
    const point = trigger.current;
    if (!isOpen || !el || !point) return;
    setOrigin({ x: point.x - el.offsetLeft, y: point.y - el.offsetTop });
  }, [isOpen]);
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
    <AnimatePresence>
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
            // Grows out of the button that opened it, from about half size, and goes back into it.
            initial={{ scale: still ? 1 : trigger.current ? 0.5 : 0.93, opacity: 0, y: trigger.current || still ? 0 : 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: still ? 1 : trigger.current ? 0.55 : 0.95, opacity: 0, y: trigger.current || still ? 0 : 10, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
            transition={{ ...SPRING, opacity: { duration: 0.2 } }}
            onClick={e => e.stopPropagation()}
            className={`relative w-full rounded-modal outline-none ${maxWidth}`}
            style={{
              transformOrigin: origin ? `${origin.x}px ${origin.y}px` : 'center',
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

import React, { useEffect, useId, useRef } from 'react';
import { Button } from '@/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { useBodyScrollLock } from '@/ui/useBodyScrollLock';

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
            initial={{ scale: 0.93, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
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
              <>{children}</>
            ) : (
              /* Content mode */
              <div className="px-8 pb-8 pt-6">{children}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

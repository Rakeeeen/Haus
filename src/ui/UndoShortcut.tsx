import React, { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { NOTICE_MS, redoLast, undoLast, useUndoNotice } from '@/lib/undoStack';
import { Boil, SketchSvg } from '@/ui/Sketch';
import { REDO_ICON, UNDO_ICON } from '@/ui/sketchIcons.data';
import { SwingIn, Toast } from '@/ui/Toast';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** How the shortcut is written on this computer. */
export const UNDO_KEY_HINT = isMac ? '⌘Z' : 'Ctrl Z';

/**
 * ⌘Z / Ctrl+Z, for the whole system: it undoes the last thing done (a task moved, changed or deleted, a glass of water, a money
 * move…) — whatever put itself on the pile with `pushUndo` — and ⌘⇧Z (Ctrl+Shift+Z or Ctrl+Y) does it again. A card at the bottom
 * says what it undid or redid, with a hand-drawn arrow that swings back (or forward) as it appears.
 *
 * It leaves text alone: in a field, or with a dialog open, ⌘Z is still that field's own undo.
 */
export const UndoShortcut: React.FC = () => {
  const notice = useUndoNotice();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      // ⌘Z undoes, ⌘⇧Z redoes (and Ctrl+Y, as on Windows).
      const redo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey && !e.shiftKey);
      const undo = key === 'z' && !e.shiftKey;
      if (!redo && !undo) return;
      if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      void (redo ? redoLast() : undoLast());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <AnimatePresence>
      {notice && (
        <Toast
          key={notice.id}
          caption={notice.caption}
          text={notice.text}
          dim={notice.dim}
          ms={NOTICE_MS}
          icon={(
            <SwingIn from={notice.kind === 'undo' ? -55 : 55}>
              <span className={notice.dim ? 'opacity-45' : ''}>
                <SketchSvg size={30}><Boil frames={(notice.kind === 'undo' ? UNDO_ICON : REDO_ICON).frames} /></SketchSvg>
              </span>
            </SwingIn>
          )}
        />
      )}
    </AnimatePresence>
  );
};

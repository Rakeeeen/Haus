import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useWork } from '@/data/useWork';
import { TrashGlyph } from '@/ui/TrashGlyph';
import { SwingIn, Toast } from '@/ui/Toast';
import { UNDO_KEY_HINT } from '@/ui/UndoShortcut';
import { UNDO_MS } from '@/data/useWork';

/**
 * Shown for a few seconds after a task is swiped (or right-clicked) away: what was deleted, and a way to bring it back. The task
 * isn't really deleted until this goes (see `deleteTaskWithUndo`). ⌘Z does the same, and goes on working after the bar is gone.
 */
export const UndoDeleteBar: React.FC = () => {
  const { pendingDelete, undoDelete } = useWork();
  return (
    <AnimatePresence>
      {pendingDelete && (
        <Toast
          key={pendingDelete.id}
          caption="Deleted"
          text={pendingDelete.title || 'Untitled'}
          ms={UNDO_MS}
          action={{ label: 'Undo', hint: UNDO_KEY_HINT, onClick: undoDelete }}
          icon={<SwingIn from={-25}><TrashGlyph size={26} /></SwingIn>}
        />
      )}
    </AnimatePresence>
  );
};

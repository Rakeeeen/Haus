import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TASK_STATUSES } from '@/domain/work/tasks';
import type { TaskStatus } from '@/domain/work/types';
import { TaskStatusChip } from '@/features/work/components/chips';
import { useDismiss } from '@/ui/useDismiss';

/**
 * A task's status right where it is listed: press it and pick another, without opening the task. When the person may not
 * change the task it is just the chip. The list floats over the page (the rows sit inside a clipping card).
 */
export const StatusPicker: React.FC<{ status: TaskStatus; editable: boolean; onPick: (status: TaskStatus) => void }> = ({ status, editable, onPick }) => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useDismiss(open, () => setOpen(false), [button, list]);

  useLayoutEffect(() => {
    if (!open) { setAt(null); return; }
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const height = list.current?.offsetHeight ?? 160;
      const below = r.bottom + 4 + height <= window.innerHeight || r.top - 4 - height < 0;
      const next = { left: Math.max(8, r.right - (list.current?.offsetWidth ?? 130)), top: below ? r.bottom + 4 : r.top - 4 - height };
      setAt((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  });

  if (!editable) return <TaskStatusChip status={status} />;
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change status"
        data-tip="Change status"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex rounded-full cursor-pointer hover:opacity-80 transition-opacity"
      >
        <TaskStatusChip status={status} />
      </button>
      {open && createPortal(
        <ul
          ref={list}
          role="listbox"
          className="fixed z-[10000] min-w-[130px] bg-paper-dark border border-ink/14 rounded-box shadow-[0_12px_32px_rgba(0,0,0,0.18)] py-1"
          style={{ left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? 'visible' : 'hidden' }}
        >
          {TASK_STATUSES.map((s) => (
            <li key={s.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={s.value === status}
                onClick={(e) => { e.stopPropagation(); setOpen(false); if (s.value !== status) onPick(s.value); }}
                className={`w-full text-left px-3.5 py-2 cursor-pointer whitespace-nowrap font-mono-main text-[12px] uppercase tracking-[0.2em] font-bold transition-colors hover:bg-ink/5 ${s.value === status ? 'text-ink' : 'text-ink/60'}`}
              >
                {s.value === status ? '● ' : '○ '}{s.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
};

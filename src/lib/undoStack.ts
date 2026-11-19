import { useSyncExternalStore } from 'react';

/**
 * One step of undoing or redoing. It does its work and returns the step that takes it back — so an undo hands back its redo, and
 * that redo hands back the undo again, for as long as someone keeps pressing. Returns nothing when it can't be taken back.
 */
export type Step = () => Promise<Step | void> | Step | void;

/** One thing that was done: what it was called, and the step that undoes it. */
export interface UndoEntry { label: string; undo: Step }

const MAX_KEPT = 50;
/** How long the notice stays on screen. */
export const NOTICE_MS = 2600;
const undone: UndoEntry[] = [];   // what can be undone, the newest last
const redone: UndoEntry[] = [];   // what has been undone and can be done again, the most recently undone last
/** The line shown after an undo or redo: which way it went, a short heading, and what it was about. `dim` is for "nothing to do". */
export interface UndoNotice { id: number; kind: 'undo' | 'redo'; caption: string; text: string; dim?: boolean }
let notice: UndoNotice | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
let fallback: (() => Promise<string | null>) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Remembers something just done, so ⌘Z / Ctrl+Z can take it back. The newest is undone first. Doing something new ends any redo. */
export function pushUndo(entry: UndoEntry): UndoEntry {
  undone.push(entry);
  if (undone.length > MAX_KEPT) undone.shift();
  redone.length = 0;
  return entry;
}

/** Forgets an entry (it has been dealt with some other way — an "Undo" button, say). */
export function dropUndo(entry: UndoEntry | null | undefined): void {
  if (!entry) return;
  const i = undone.indexOf(entry);
  if (i >= 0) undone.splice(i, 1);
}

/** A step that sets a value back — and, taken back, sets it forward again, and so on. */
export function valueStep<T>(set: (value: T) => unknown, from: T, to: T): Step {
  return async () => { await set(to); return valueStep(set, to, from); };
}

/** What ⌘Z does when there is nothing in the pile (after a reload, say): it may bring something back and return what it was called, or null. */
export function setUndoFallback(fn: (() => Promise<string | null>) | null): void {
  fallback = fn;
}

function say(kind: 'undo' | 'redo', caption: string, text: string, dim = false): void {
  notice = { id: nextId++, kind, caption, text, dim };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => { notice = null; emit(); }, NOTICE_MS);
}

async function run(from: UndoEntry[], to: UndoEntry[], kind: 'undo' | 'redo'): Promise<boolean> {
  const entry = from.pop();
  if (!entry) return false;
  try {
    const inverse = await entry.undo();
    if (inverse) to.push({ label: entry.label, undo: inverse });
    say(kind, kind === 'undo' ? 'Undid' : 'Redid', entry.label);
    return true;
  } catch (error) {
    console.warn(`Could not ${kind} "${entry.label}":`, error);
    say(kind, `Couldn't ${kind}`, entry.label, true);
    return false;
  }
}

/** Undoes the last thing done. Says what it undid (or that it couldn't, or that there was nothing). */
export async function undoLast(): Promise<boolean> {
  if (undone.length) return run(undone, redone, 'undo');
  const brought = await fallback?.().catch(() => null);
  if (brought) { say('undo', 'Brought back', brought); return true; }
  say('undo', 'Undo', 'Nothing to undo yet', true);
  return false;
}

/** Does again what was last undone. */
export async function redoLast(): Promise<boolean> {
  if (redone.length) return run(redone, undone, 'redo');
  say('redo', 'Redo', 'Nothing to redo', true);
  return false;
}

/** The line to show after an undo or redo, for a moment; null when there is none. */
export function useUndoNotice(): UndoNotice | null {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => notice, () => null);
}

/** For tests: forget everything. */
export function resetUndoForTests(): void {
  undone.length = 0; redone.length = 0; notice = null; fallback = null; clearTimeout(timer); emit();
}

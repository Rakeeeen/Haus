import { useState, useEffect, useRef, useCallback } from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { readStored, scopedDoc, storageKey, writeStored } from '@/data/dataScope';

/**
 * A value that lives in Firestore (the signed-in person's own `dashboard/{key}`) and in localStorage, as `[value, setValue, ready]`.
 *
 * - It starts from localStorage, so the screen paints at once; Firestore's answer replaces it when it arrives (`ready`).
 * - `setValue` (also in the `prev => next` form) is optimistic: state and localStorage change first, then Firestore is written.
 * - Every write carries an `updatedAt`; a snapshot older than the last local write is ignored, so a slow server copy can't
 *   undo what was just typed. (And `setValue` keeps one identity across renders on purpose — see CLAUDE.md.)
 */
export function useFirebaseSync<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => readStored(key, initialValue));

  const [isReady, setIsReady] = useState(false);

  // Latest value, readable synchronously from setValue's functional-update form
  // without having to list `storedValue` as a dependency (which would make
  // `setValue` a new function on every change and thrash consumers' effects).
  const valueRef = useRef(storedValue);
  useEffect(() => { valueRef.current = storedValue; }, [storedValue]);

  // 2. Listen to Firestore changes (for sync across devices)
  useEffect(() => {
    const docRef = scopedDoc(key);
    // Signed out or not allowed in: only the local copy, nothing to listen to.
    if (!docRef) {
      setIsReady(true);
      return;
    }

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().value as T;
        const serverUpdatedAt = docSnap.data().updatedAt;
        const localUpdatedAt = window.localStorage.getItem(`${storageKey(key)}_updatedAt`);

        // Only apply if server data is newer or same as our last local update
        if (!localUpdatedAt || !serverUpdatedAt || new Date(serverUpdatedAt).getTime() >= new Date(localUpdatedAt).getTime()) {
          valueRef.current = data;
          setStoredValue(data);
          window.localStorage.setItem(storageKey(key), JSON.stringify(data));
          if (serverUpdatedAt) {
            window.localStorage.setItem(`${storageKey(key)}_updatedAt`, serverUpdatedAt);
          }
        }
      }
      setIsReady(true);
    }, (error) => {
      console.warn("Firestore Listen Error:", error);
      setIsReady(true);
    });

    return () => unsubscribe();
  }, [key]);

  // 3. Update Function (Updates both Local and Remote) — stable identity across renders
  const setValue = useCallback(async (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function
        ? (value as (val: T) => T)(valueRef.current)
        : value;

      // Local first (optimistic), then Firestore.
      const now = new Date().toISOString();
      valueRef.current = valueToStore;
      setStoredValue(valueToStore);
      writeStored(key, valueToStore, now);

      const docRef = scopedDoc(key);
      if (docRef) await setDoc(docRef, { value: valueToStore, updatedAt: now });
    } catch (error) {
      console.error("Firestore Sync Error:", error);
    }
  }, [key]);

  return [storedValue, setValue, isReady] as const;
}

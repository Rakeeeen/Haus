import { useState, useEffect, useRef, useCallback } from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { scopedDoc, storageKey } from '@/data/dataScope';

export function useFirebaseSync<T>(key: string, initialValue: T) {
  // 1. Initial State from LocalStorage (for speed)
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(storageKey(key));
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

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

      // Update local state first (Optimistic UI)
      valueRef.current = valueToStore;
      setStoredValue(valueToStore);
      window.localStorage.setItem(storageKey(key), JSON.stringify(valueToStore));

      // Sync to Firestore
      const now = new Date().toISOString();
      window.localStorage.setItem(`${storageKey(key)}_updatedAt`, now);

      const docRef = scopedDoc(key);
      if (docRef) await setDoc(docRef, { value: valueToStore, updatedAt: now });
    } catch (error) {
      console.error("Firestore Sync Error:", error);
    }
  }, [key]);

  return [storedValue, setValue, isReady] as const;
}

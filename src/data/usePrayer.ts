import { useSyncExternalStore } from 'react';
import type { PrayerTimes } from '@/domain/devotion/prayer';
import type { HijriDate } from '@/domain/devotion/occasion';

/** Today's prayer times and hijri date, from the Aladhan API (Cairo coordinates, method 5), kept in localStorage between visits. */
export interface PrayerData {
  times: PrayerTimes;
  /** "9 جمادى الأولى 1448 هـ" */
  hijri: string;
  hijriDate: HijriDate | null;
  /** The first answer for today has not arrived yet (what is shown is yesterday's, or nothing). */
  loading: boolean;
}

const TIMES_KEY = 'prayer_times';
const HIJRI_KEY = 'prayer_hijri';
const HIJRI_PARTS_KEY = 'prayer_hijri_parts';
const FETCHED_ON_KEY = 'prayer_fetched_on';
const API = 'https://api.aladhan.com/v1/timings';
const LATITUDE = 31.0379;
const LONGITUDE = 31.3815;
const CALCULATION_METHOD = 5;
/** While anything is listening, how often to check whether the date has changed and the times need fetching again. */
const NEW_DAY_CHECK_MS = 30 * 60_000;

const today = () => new Date().toDateString();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStored(): PrayerData {
  return {
    times: readJson<PrayerTimes>(TIMES_KEY, {}),
    hijri: localStorage.getItem(HIJRI_KEY) || '',
    hijriDate: readJson<HijriDate | null>(HIJRI_PARTS_KEY, null),
    loading: localStorage.getItem(FETCHED_ON_KEY) !== today(),
  };
}

/**
 * One shared copy for the whole app. Prayer times used to be fetched — and a one-second timer started — by every component that
 * asked for them (six of them), so the page fetched six times and the app re-rendered every second. Now the first listener
 * starts one fetch, everyone reads the same value, and it is fetched again only when the date changes.
 */
const store = {
  snapshot: readStored(),
  listeners: new Set<() => void>(),
  timer: null as ReturnType<typeof setInterval> | null,
  fetching: false,
};

function publish(next: PrayerData) {
  store.snapshot = next;
  store.listeners.forEach((listener) => listener());
}

async function load(): Promise<void> {
  if (store.fetching) return;
  store.fetching = true;
  try {
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const response = await fetch(`${API}/${date}?latitude=${LATITUDE}&longitude=${LONGITUDE}&method=${CALCULATION_METHOD}`);
    const body = await response.json();
    if (body.code !== 200) return;
    const { timings, date: day } = body.data;
    const hijri = `${day.hijri.day} ${day.hijri.month.ar} ${day.hijri.year} هـ`;
    const parts = { day: Number(day.hijri.day), month: Number(day.hijri.month.number) };
    const hijriDate = Number.isFinite(parts.day) && Number.isFinite(parts.month) ? parts : store.snapshot.hijriDate;
    localStorage.setItem(TIMES_KEY, JSON.stringify(timings));
    localStorage.setItem(HIJRI_KEY, hijri);
    if (hijriDate) localStorage.setItem(HIJRI_PARTS_KEY, JSON.stringify(hijriDate));
    localStorage.setItem(FETCHED_ON_KEY, today());
    publish({ times: timings, hijri, hijriDate, loading: false });
  } catch (error) {
    console.error('Failed to fetch prayer times', error);
  } finally {
    store.fetching = false;
    if (store.snapshot.loading) publish({ ...store.snapshot, loading: false });
  }
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  if (store.listeners.size === 1) {
    if (store.snapshot.loading || localStorage.getItem(FETCHED_ON_KEY) !== today()) void load();
    store.timer = setInterval(() => { if (localStorage.getItem(FETCHED_ON_KEY) !== today()) void load(); }, NEW_DAY_CHECK_MS);
  }
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size === 0 && store.timer) {
      clearInterval(store.timer);
      store.timer = null;
    }
  };
}

/** Today's prayer times and hijri date (the same value everywhere; see above). */
export function usePrayer(): PrayerData {
  return useSyncExternalStore(subscribe, () => store.snapshot);
}

/** Forgets what was loaded and starts again from localStorage — for tests. */
export function resetPrayerStoreForTests(): void {
  store.snapshot = readStored();
  store.fetching = false;
  if (store.timer) clearInterval(store.timer);
  store.timer = null;
  store.listeners.clear();
}

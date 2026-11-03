// Same source and coordinates as src/data/usePrayer.ts (Cairo, Aladhan method 5),
// cached for the day in memory — the bot only needs Fajr/Maghrib/Isha for the
// water and focus lock windows, refetched once per calendar date.

let cache = { dateKey: null, timings: null };

async function fetchTodayTimings() {
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const res = await fetch(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=31.0379&longitude=31.3815&method=5`);
  const data = await res.json();
  if (data.code !== 200) throw new Error('Aladhan API error');
  return data.data.timings;
}

async function getTodayTimings() {
  const dateKey = new Date().toDateString();
  if (cache.dateKey === dateKey && cache.timings) return cache.timings;
  try {
    const timings = await fetchTodayTimings();
    cache = { dateKey, timings };
    return timings;
  } catch (e) {
    console.error('⚠️ Failed to fetch prayer timings:', e.message);
    // Fall back to the previous day's cache (close enough) or fixed defaults.
    return cache.timings || { Fajr: '04:00', Maghrib: '18:00' };
  }
}

/** Whether `now` falls between `timings[startKey]` (today) and Fajr (today). */
async function isInNightWindow(startKey, fallback, now) {
  const timings = await getTodayTimings();
  const [fajrH, fajrM] = (timings.Fajr || '04:00').split(':').map(Number);
  const todayFajr = new Date(now);
  todayFajr.setHours(fajrH, fajrM, 0, 0);
  const [startH, startM] = (timings[startKey] || fallback).split(':').map(Number);
  const todayStart = new Date(now);
  todayStart.setHours(startH, startM, 0, 0);
  return now >= todayStart || now < todayFajr;
}

/** Whether `now` falls in the Maghrib→Fajr water-logging lock window. */
export async function isWaterLocked(now = new Date()) {
  return isInNightWindow('Maghrib', '18:00', now);
}

/** Whether `now` falls in the Isha→Fajr focus-session lock window. */
export async function isFocusLocked(now = new Date()) {
  return isInNightWindow('Isha', '19:00', now);
}

/** Today's Maghrib as "HH:MM" — what the late-glass rule needs to name the day that just closed. */
export async function getMaghrib() {
  return (await getTodayTimings()).Maghrib || '18:00';
}

/** Whether `now` is the minute of today's Isha adhan — when the daily report goes out. */
export async function isIshaNow(now = new Date()) {
  const { Isha } = await getTodayTimings();
  const [hours, minutes] = (Isha || '19:00').split(':').map(Number);
  return now.getHours() === hours && now.getMinutes() === minutes;
}

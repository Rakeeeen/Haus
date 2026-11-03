import { getDashboardValue, setDashboardValue } from '../lib/firestore.js';
import { isWaterLocked, getMaghrib } from '../lib/prayerTimes.js';
import { archivedDayKey, applyLateGlass } from '../lib/lateGlass.js';
import { isFriday } from '../lib/day.js';
import { card, row, ButtonStyle } from '../lib/ui.js';
import { NAME_MARKED } from '../lib/brand.js';

const GOAL = 12;
const GLASS_KEY = 'hydration_glasses';
const FRIDAY_KEY = 'friday_opt_in';
const HISTORY_KEY = 'hydration_history';
const RESET_KEY = 'system_last_reset_date';

export async function readState() {
  const [glasses, optIns, locked, history, maghrib] = await Promise.all([
    getDashboardValue(GLASS_KEY, 0),
    getDashboardValue(FRIDAY_KEY, {}),
    isWaterLocked(),
    getDashboardValue(HISTORY_KEY, {}),
    getMaghrib(),
  ]);
  const now = new Date();
  const dateKey = now.toDateString();
  const friday = isFriday(now);
  const fridayLocked = friday && !optIns[dateKey];
  // While water is closed the day's tally lives in history (the live counter was zeroed at Maghrib),
  // so the number to show is both together — the same figure the web page shows.
  const shown = locked ? glasses + ((history || {})[archivedDayKey(maghrib, now)] || 0) : glasses;
  return { glasses, shown, fridayLocked, locked };
}

/** Renders the Water card as {embeds, components} — used for both the first reply and every button update. */
export async function buildWaterView() {
  const { glasses, shown, fridayLocked, locked } = await readState();

  if (fridayLocked) {
    return {
      embeds: [card({
        domain: 'water',
        headline: "It's Jumu'ah — Friday is opt-in system-wide.",
        big: `${shown} / ${GOAL}`,
        note: `${NAME_MARKED} · Water · nothing logged counts until you opt in`,
      })],
      components: [row([
        { id: 'water:fridayoptin', label: 'Count Today Anyway', style: ButtonStyle.Success },
        { id: 'bommy:home', label: 'Main Menu' },
      ])],
    };
  }

  return {
    embeds: [card({
      domain: 'water',
      headline: locked ? 'Logging reopens at Fajr.' : 'Glasses today',
      big: `${shown} / ${GOAL}`,
    })],
    components: [row([
      locked
        ? { id: 'water:late', label: 'Late Glass', style: ButtonStyle.Success }
        : { id: 'water:add', label: 'Add Glass', style: ButtonStyle.Success },
      { id: 'water:undo', label: 'Undo', disabled: locked || glasses <= 0 },
      { id: 'bommy:home', label: 'Main Menu' },
    ])],
  };
}

export async function addGlass() {
  const { glasses, locked, fridayLocked } = await readState();
  if (!locked && !fridayLocked) await setDashboardValue(GLASS_KEY, glasses + 1);
}

export async function undoGlass() {
  const { glasses, locked, fridayLocked } = await readState();
  if (!locked && !fridayLocked && glasses > 0) await setDashboardValue(GLASS_KEY, glasses - 1);
}

/** A glass after Maghrib: counted for the day that just closed. @returns {{ ok: true } | { ok: false, message: string }} */
export async function addLateGlass() {
  const { locked, fridayLocked } = await readState();
  if (!locked) return { ok: false, message: 'Water is still open — use Add Glass.' };
  if (fridayLocked) return { ok: false, message: "It's Jumu'ah — count today first." };
  const [glasses, history, lastResetDate, maghrib] = await Promise.all([
    getDashboardValue(GLASS_KEY, 0),
    getDashboardValue(HISTORY_KEY, {}),
    getDashboardValue(RESET_KEY, ''),
    getMaghrib(),
  ]);
  const next = applyLateGlass({ glasses, history: history || {} }, lastResetDate, archivedDayKey(maghrib));
  if (next.glasses !== glasses) await setDashboardValue(GLASS_KEY, next.glasses);
  else await setDashboardValue(HISTORY_KEY, next.history);
  return { ok: true };
}

export async function optInFriday() {
  const optIns = await getDashboardValue(FRIDAY_KEY, {});
  const dateKey = new Date().toDateString();
  await setDashboardValue(FRIDAY_KEY, { ...optIns, [dateKey]: true });
}

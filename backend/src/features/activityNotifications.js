import { getDocument, setDocument, watchCollection } from '../lib/firestore.js';
import { card } from '../lib/ui.js';

// Tells Discord what a guest does in Haus. The web app writes a line to `activity_log` for each action (signing in, adding,
// moving or deleting a task, a comment — see src/data/activityLog.ts); this watches for them and posts each one to a channel.
//
// The bot is not always on, so how far it has told is kept in Firestore (`mail_state/activity.since`, the time of the last line
// told): when it wakes it tells what it missed, each with the time it happened. The very first run only starts from now.

/** The most it tells in one go after being off (a long absence is a few lines and a count, not a flood). */
const MAX_AT_ONCE = 20;
const RETRY_MS = 60 * 1000;

const ICON = { entered: '🚪', task_created: '➕', task_status: '🔄', task_deleted: '🗑️', comment: '💬' };

/** The lines to tell now: newer than `since`, oldest first. `entries` are `{ id, at: Date, ... }`. */
export function linesToTell(entries, since) {
  return entries
    .filter((e) => e.at && (!since || e.at.getTime() > Date.parse(since)))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** One line as a Discord card: who, then what they did. */
export function lineCard(entry) {
  const embed = card({
    domain: 'system',
    big: `${ICON[entry.type] ?? '•'} ${entry.name || 'A guest'}`,
    headline: entry.text,
    note: 'Haus · a guest did this',
  });
  return embed.setTimestamp(entry.at);
}

const toEntry = (doc) => {
  const data = doc.data();
  return { id: doc.id, ...data, at: data.at?.toDate ? data.at.toDate() : null };
};

/**
 * Starts watching. `client` is the Discord client (the bot's own login); `channelId` the channel to tell.
 * Returns a function that stops it.
 */
export function watchActivity(client, channelId) {
  let busy = false;
  let again = false;
  let latest = [];
  let timer = null;

  const run = async () => {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const state = await getDocument('mail_state', 'activity');
      if (!state?.since) {
        // The first time: only what happens from now on is told, not the log's whole past.
        await setDocument('mail_state', 'activity', { since: new Date().toISOString() });
        return;
      }
      const due = linesToTell(latest, state.since);
      if (due.length === 0) return;
      const channel = await client.channels.fetch(channelId);
      const skipped = Math.max(0, due.length - MAX_AT_ONCE);
      const toSend = due.slice(skipped);
      if (skipped) await channel.send(`…and ${skipped} earlier ${skipped === 1 ? 'action' : 'actions'} while the bot was off.`);
      let told = state.since;
      for (const entry of toSend) {
        await channel.send({ embeds: [lineCard(entry)] });
        told = entry.at.toISOString();
        await setDocument('mail_state', 'activity', { since: told });
      }
      if (skipped) await setDocument('mail_state', 'activity', { since: due[due.length - 1].at.toISOString() });
    } catch (error) {
      console.error('❌ Could not tell Discord about a guest:', error.message);
      // Not marked as told, so it is tried again.
      timer = setTimeout(run, RETRY_MS);
    } finally {
      busy = false;
      if (again) { again = false; run(); }
    }
  };

  const stop = watchCollection('activity_log', (snap) => {
    latest = snap.docs.map(toEntry);
    run();
  });
  return () => { stop(); if (timer) clearTimeout(timer); };
}

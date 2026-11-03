import { App } from '@slack/bolt';
import {
  hubView, waterView, focusView, financeHomeView, banksView, bankView, bucketsView, bucketChoiceView,
  amountModal, sessionLoggedText,
} from './views.js';
import { addGlass, undoGlass, addLateGlass, optInFriday } from '../features/water.js';
import {
  startFocusRemote, pauseFocusRemote, resumeFocusRemote, doneFocusRemote, discardFocusRemote, skipBreakFocusRemote,
} from '../features/focus.js';
import { applyBankChange, isKnownBank, isKnownBucket } from '../features/finance.js';
import { dashboardConfigured } from '../lib/firestore.js';

/**
 * The Slack control panel — the same hub / Water / Focus / Finance cards as the Discord bot, opened
 * with `/firmus` (or `/firmus water|focus|finance`). Runs over Socket Mode, so it needs no public URL.
 * Cards are ephemeral (only you see them) and are edited in place, so nothing piles up in a channel.
 *
 * Access: only SLACK_OWNER_USER_ID may use it, and only in the control channel (SLACK_CONTROL_CHANNEL_ID). Until the owner is set, anyone who tries is told their own member id to put in backend/.env.
 *
 * A card deletes itself a minute after the last press — except the Focus card, which is meant to be left
 * open (same as on Discord).
 */

const VIEWS = { water: waterView, focus: focusView, finance: financeHomeView };

const WATER_ACTIONS = { 'water:add': addGlass, 'water:undo': undoGlass, 'water:fridayoptin': optInFriday };
const FOCUS_ACTIONS = {
  'focus:start': startFocusRemote,
  'focus:pause': pauseFocusRemote,
  'focus:resume': resumeFocusRemote,
  'focus:discard': discardFocusRemote,
  'focus:skipbreak': skipBreakFocusRemote,
};

// Slack can deliver the same button press more than once; each press has its own trigger_id, so a repeat is dropped.
const seenPresses = new Map();
function isRepeatPress(triggerId) {
  const now = Date.now();
  for (const [id, at] of seenPresses) if (now - at > 60_000) seenPresses.delete(id);
  if (!triggerId) return false;
  if (seenPresses.has(triggerId)) return true;
  seenPresses.set(triggerId, now);
  return false;
}

const CARD_LIFETIME_MS = 60_000;
const expiries = new Map(); // `${channel}:${user}` → { timer, respond } — one live card per person per channel

/** Deletes the card now and forgets it. */
function retire(key) {
  const entry = expiries.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  expiries.delete(key);
  entry.respond({ delete_original: true }).catch(() => {});
}

/** (Re)starts the minute countdown for a card; `respond` is whatever can still edit that message. */
function keepFor(key, respond, view) {
  const old = expiries.get(key);
  if (old) clearTimeout(old.timer);
  if (view?.persistent) { expiries.delete(key); return; }
  const timer = setTimeout(() => {
    expiries.delete(key);
    respond({ delete_original: true }).catch(() => {});
  }, CARD_LIFETIME_MS);
  expiries.set(key, { timer, respond });
}

const ephemeral = (text) => ({ response_type: 'ephemeral', replace_original: false, text });

/** Posts to a Slack `response_url` (what a modal needs to update the card it was opened from). */
async function postToResponseUrl(url, body) {
  if (!url) return;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) console.error(`⚠️ Slack response_url rejected the update: HTTP ${res.status}`);
}

/** What a button press should leave on the card. Returns a view, or null if the press isn't one of ours. */
async function handleAction(id, { respond, client, body }, expireKey) {
  const note = (text) => respond(ephemeral(text));

  if (id === 'bommy:home') return hubView();
  if (id === 'bommy:water') return waterView();
  if (id === 'bommy:focus') return focusView();
  if (id === 'bommy:finance') return financeHomeView();

  if (WATER_ACTIONS[id]) { await WATER_ACTIONS[id](); return waterView(); }
  if (id === 'water:late') {
    const result = await addLateGlass();
    if (!result.ok) await note(result.message);
    return waterView();
  }

  if (id === 'focus:refresh') return focusView();
  if (id === 'focus:done') {
    const result = await doneFocusRemote();
    if (result.ok) await respond({ response_type: 'ephemeral', replace_original: false, text: sessionLoggedText(result.focusGained, result.overtimeSeconds) });
    else await note(result.message);
    return focusView();
  }
  if (FOCUS_ACTIONS[id]) {
    const result = await FOCUS_ACTIONS[id]();
    if (!result.ok) await note(result.message);
    return focusView();
  }

  if (id === 'finance:home') return financeHomeView();
  if (id === 'finance:banks') return banksView();
  if (id === 'finance:buckets') return bucketsView();
  if (id.startsWith('finance:bank:')) {
    const key = id.split(':')[2];
    if (isKnownBank(key)) return bankView(key);
  }
  if (id.startsWith('finance:deposit:') || id.startsWith('finance:withdraw:')) {
    const [, action, key] = id.split(':');
    if (isKnownBank(key)) return bucketChoiceView(action, key);
  }
  if (id.startsWith('finance:amount:')) {
    const [, , action, bankKey, bucketKey] = id.split(':');
    if (isKnownBank(bankKey) && (bucketKey === 'none' || isKnownBucket(bucketKey))) {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: amountModal({ action, bankKey, bucketKey, responseUrl: body.response_url, expireKey }),
      });
      keepFor(expireKey, respond); // filling in the form shouldn't cost the card its minute
    }
    return null; // the card stays as it is until the form is submitted
  }
  return null;
}

export function startSlack({ botToken, appToken, ownerId, controlChannelId }) {
  const app = new App({ token: botToken, appToken, socketMode: true });

  // Every command, button and form goes through here first.
  app.use(async (args) => {
    const { body, ack, respond, next } = args;
    const userId = body.user_id ?? body.user?.id;
    if (!ownerId || userId !== ownerId) {
      const message = ownerId
        ? 'Not available here.'
        : `Control isn't unlocked yet — put SLACK_OWNER_USER_ID=${userId} in backend/.env and restart the bot.`;
      await ack?.();
      await respond?.({ response_type: 'ephemeral', replace_original: false, text: message });
      return;
    }
    // A form is only ever opened from a card in the control channel, and carries no channel of its own.
    if (body.type === 'view_submission') return next();
    const channelId = body.channel_id ?? body.channel?.id;
    if (!controlChannelId || channelId !== controlChannelId) {
      // Slack hides a private channel's name from the app ("privategroup"), so the channel is matched by id.
      const message = controlChannelId
        ? 'Not available here.'
        : `No control channel yet — put SLACK_CONTROL_CHANNEL_ID=${channelId} in backend/.env (this channel) and restart the bot.`;
      await ack?.();
      await respond?.({ response_type: 'ephemeral', replace_original: false, text: message });
      return;
    }
    return next();
  });

  app.command('/firmus', async ({ ack, command, respond }) => {
    await ack();
    if (!dashboardConfigured()) {
      await respond(ephemeral('`backend/serviceAccountKey.json` is missing — dashboard control isn\'t set up yet.'));
      return;
    }
    const key = `${command.channel_id}:${command.user_id}`;
    retire(key); // an older card of yours still on screen goes now
    const build = VIEWS[command.text.trim().toLowerCase()] ?? hubView;
    const view = await build();
    await respond({ response_type: 'ephemeral', ...view });
    keepFor(key, respond, view);
  });

  app.action(/^(bommy|water|focus|finance):/, async (args) => {
    const { ack, action, respond, body } = args;
    const key = `${body.channel?.id}:${body.user.id}`;
    await ack();
    console.log(`💬 Slack press ${action.action_id} (trigger ${body.trigger_id})`);
    if (isRepeatPress(body.trigger_id)) { console.log('↩️  Ignored a repeated delivery of that press'); return; }
    try {
      const view = await handleAction(action.action_id, args, key);
      if (view) {
        await respond({ replace_original: true, ...view });
        keepFor(key, respond, view);
      }
    } catch (error) {
      console.error('❌ Slack action error:', error);
      await respond(ephemeral('Something went wrong — try again.')).catch(() => {});
    }
  });

  app.view('finance:modal', async ({ ack, view }) => {
    const { action, bankKey, bucketKey, responseUrl, expireKey } = JSON.parse(view.private_metadata);
    const raw = (view.state.values.amount.value.value ?? '').replace(/,/g, '').trim();
    try {
      const result = await applyBankChange(bankKey, action, Number(raw), bucketKey === 'none' ? null : bucketKey);
      if (!result.ok) { await ack({ response_action: 'errors', errors: { amount: result.message } }); return; }
      await ack();
      const respondTo = (payload) => postToResponseUrl(responseUrl, payload);
      await respondTo({ replace_original: true, ...(await bankView(bankKey)) });
      keepFor(expireKey, async (payload) => respondTo(payload));
    } catch (error) {
      console.error('❌ Slack finance form error:', error);
      await ack({ response_action: 'errors', errors: { amount: 'Something went wrong — try again.' } }).catch(() => {});
    }
  });

  app.error(async (error) => console.error('⚠️ Slack app error:', error.message));

  return app.start().then(() => console.log('💬 Slack control panel is online (/firmus)'));
}

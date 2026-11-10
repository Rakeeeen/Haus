import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import { Agent } from 'undici';
import { ACTIVITY_CHANNEL_ID, CONTROL_CHANNEL_ID, REPORT_CHANNEL_ID } from './src/config.js';
import { watchActivity } from './src/features/activityNotifications.js';
import { registerCommands } from './src/discord/commands.js';
import { routeInteraction } from './src/discord/router.js';
import { cleanChannel } from './src/features/cleanup.js';
import { watchFocusNotifications } from './src/features/focusNotifications.js';
import { watchMailNotifications } from './src/features/mailNotifications.js';
import { sendDailyReport, sendGuestReport } from './src/features/report/send.js';
import { reportRecipients } from './src/features/report/guest.js';
import { remindDueSubscriptions } from './src/features/subscriptions.js';
import { afterAttempt, afterGuestAttempt, afterMaghrib, guestsDue, readGuestState, readState, reportDue, writeGuestState, writeState } from './src/features/report/schedule.js';
import { getMaghrib } from './src/lib/prayerTimes.js';
import { startServer } from './src/server.js';
import { startSlack } from './src/slack/app.js';

const CHANNEL_ID = CONTROL_CHANNEL_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'PUT_YOUR_BOT_TOKEN_HERE';
const SERVER_PORT = Number(process.env.WEBHOOK_PORT || 3001);
const TIME_ZONE = { timezone: 'Africa/Cairo' };
const LOGIN_RETRY_MS = 30_000;

// Discord gets its own HTTP agent. The Slack library installs its own (newer) undici as the process-wide default, and a
// file upload built by discord.js's undici is refused by that one ("body must be a FormData created by this undici
// package instance") — which is why the Maghrib report, the only upload, never arrived.
const client = new Client({ intents: [GatewayIntentBits.Guilds], rest: { agent: new Agent() } });

// Without a listener, an 'error' event (a dropped gateway connection, a handshake timeout) is an
// unhandled EventEmitter error and takes the whole process down. discord.js already reconnects on
// its own for ordinary hiccups — this just stops a rough one from killing the bot.
client.on('error', (error) => {
  console.error('⚠️ Discord client error (not fatal, discord.js keeps retrying):', error.message);
});

client.on('interactionCreate', routeInteraction);

/** Runs a scheduled job, logging instead of crashing if it throws. */
const guarded = (name, job) => async () => {
  try {
    await job();
  } catch (error) {
    console.error(`❌ ${name} failed:`, error);
  }
};

let guestList = null;

client.once('clientReady', async () => {
  console.log(`🤖 Discord bot is online as ${client.user.tag}`);

  // The dashboard control panel (/bommy /water /focus /finance)
  await registerCommands(client, CHANNEL_ID).catch((error) => console.error('❌ Failed to register slash commands:', error.message));

  cron.schedule('0 2 * * *', guarded('Channel cleanup', async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    console.log(`🧹 Cleaned the channel: ${await cleanChannel(channel)} messages removed`);
  }));
  cron.schedule('* * * * *', guarded('Payit reminders', () => remindDueSubscriptions(client, CHANNEL_ID)));
  // Maghrib moves every day (from the prayer API, like the water and focus locks), so the report is checked each minute.
  // It goes out at Maghrib, or when the Mac wakes if it was asleep then; the state file keeps it to once a day.
  cron.schedule('* * * * *', guarded('Daily report', async () => {
    const now = new Date();
    const state = readState();
    if (!reportDue({ now, maghrib: await getMaghrib(), state })) return;
    // Written before trying, so a send that takes longer than a minute isn't started twice.
    writeState(afterAttempt(state, now, false));
    await sendDailyReport(client, REPORT_CHANNEL_ID);
    writeState(afterAttempt(readState(), now, true));
  }), TIME_ZONE);
  // What guests do in Haus, told to its own channel as it happens.
  try { watchActivity(client, ACTIVITY_CHANNEL_ID); } catch (error) { console.error('❌ Could not watch guest activity:', error.message); }
  // Each guest's own report goes out the same evening, right after Hamed's: one message per person, tried again (up to five
  // times) only for the ones that did not get through.
  cron.schedule('* * * * *', guarded('Guest reports', async () => {
    const now = new Date();
    const maghrib = await getMaghrib();
    // Nothing is read from Firestore until Maghrib has come, and then the list of guests is kept for ten minutes: this runs every
    // minute, and Firestore's free daily reads are not for spending on a check that has nothing to do.
    if (!afterMaghrib(now, maghrib)) return;
    if (!guestList || now - guestList.at > 10 * 60_000) guestList = { at: now, people: await reportRecipients() };
    const people = guestList.people;
    const due = guestsDue({ now, maghrib, state: readGuestState(), uids: people.map((p) => p.uid) });
    for (const uid of due) {
      const person = people.find((p) => p.uid === uid);
      // Written before trying, so a send that takes longer than a minute isn't started twice.
      writeGuestState(afterGuestAttempt(readGuestState(), now, uid, false));
      try {
        await sendGuestReport(client, REPORT_CHANNEL_ID, person);
        writeGuestState(afterGuestAttempt(readGuestState(), now, uid, true));
      } catch (error) {
        console.error(`❌ ${person.name}'s report failed:`, error.message);
      }
    }
  }), TIME_ZONE);
  console.log('⏰ Scheduled: channel cleanup 02:00 · Payit reminders every minute · daily report at Maghrib');
});

// A failed login used to be permanent — one transient timeout left the bot running but cut off from
// Discord forever. This keeps trying until it gets in.
function loginWithRetry() {
  client.login(BOT_TOKEN).catch((error) => {
    console.error(`❌ Failed to log in, retrying in ${LOGIN_RETRY_MS / 1000}s:`, error.message);
    setTimeout(loginWithRetry, LOGIN_RETRY_MS);
  });
}
loginWithRetry();

// The HTTP API doesn't need Discord, so it starts regardless of the login.
startServer(SERVER_PORT, () => console.log(`🌐 Webhook server running on port ${SERVER_PORT}`));

// The focus timer's messages: the web app writes each event to Firestore, this posts it to Discord.
try {
  watchFocusNotifications(process.env.DISCORD_POMODORO_WEBHOOK_URL);
} catch (error) {
  console.error('❌ Could not watch the focus timer:', error.message);
}

// Email: an invitation, and a task given to someone — the same way, from Firestore (see features/mailNotifications.js).
try {
  watchMailNotifications();
} catch (error) {
  console.error('❌ Could not watch for email:', error.message);
}

// The Slack control panel (/firmus) — an alternative to the Discord one, started only when its tokens are set.
if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
  startSlack({
    botToken: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    ownerId: process.env.SLACK_OWNER_USER_ID,
    controlChannelId: process.env.SLACK_CONTROL_CHANNEL_ID,
  }).catch((error) => console.error('❌ Could not start the Slack control panel:', error.message));
}

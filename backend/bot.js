import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import { CONTROL_CHANNEL_ID } from './src/config.js';
import { registerCommands } from './src/discord/commands.js';
import { routeInteraction } from './src/discord/router.js';
import { cleanChannel } from './src/features/cleanup.js';
import { watchFocusNotifications } from './src/features/focusNotifications.js';
import { sendDailyReport } from './src/features/report/send.js';
import { remindDueSubscriptions } from './src/features/subscriptions.js';
import { isIshaNow } from './src/lib/prayerTimes.js';
import { startServer } from './src/server.js';
import { startSlack } from './src/slack/app.js';

const CHANNEL_ID = CONTROL_CHANNEL_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'PUT_YOUR_BOT_TOKEN_HERE';
const SERVER_PORT = Number(process.env.WEBHOOK_PORT || 3001);
const TIME_ZONE = { timezone: 'Africa/Cairo' };
const LOGIN_RETRY_MS = 30_000;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

client.once('clientReady', async () => {
  console.log(`🤖 Discord bot is online as ${client.user.tag}`);

  // The dashboard control panel (/bommy /water /focus /finance)
  await registerCommands(client, CHANNEL_ID).catch((error) => console.error('❌ Failed to register slash commands:', error.message));

  cron.schedule('0 2 * * *', guarded('Channel cleanup', async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    console.log(`🧹 Cleaned the channel: ${await cleanChannel(channel)} messages removed`);
  }));
  cron.schedule('* * * * *', guarded('Payit reminders', () => remindDueSubscriptions(client, CHANNEL_ID)));
  // Isha moves every day (from the prayer API, like the water and focus locks), so the report is checked each minute.
  cron.schedule('* * * * *', guarded('Daily report', async () => {
    if (await isIshaNow()) await sendDailyReport(client, CHANNEL_ID);
  }), TIME_ZONE);
  console.log('⏰ Scheduled: channel cleanup 02:00 · Payit reminders every minute · daily report at Isha');
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

// The Slack control panel (/firmus) — an alternative to the Discord one, started only when its tokens are set.
if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
  startSlack({
    botToken: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    ownerId: process.env.SLACK_OWNER_USER_ID,
    controlChannelId: process.env.SLACK_CONTROL_CHANNEL_ID,
  }).catch((error) => console.error('❌ Could not start the Slack control panel:', error.message));
}

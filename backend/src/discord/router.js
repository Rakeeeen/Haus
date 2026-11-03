import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { commands } from './commands.js';
import { buildHubView } from '../features/hub.js';
import { buildWaterView, addGlass, undoGlass, addLateGlass, optInFriday } from '../features/water.js';
import {
  buildFocusView, startFocusRemote, pauseFocusRemote, resumeFocusRemote,
  doneFocusRemote, discardFocusRemote, skipBreakFocusRemote, buildSessionLoggedNotice,
} from '../features/focus.js';
import {
  buildHomeView as buildFinanceHomeView,
  buildBanksView, buildBankView, buildBucketsView, buildBucketChoiceView,
  applyBankChange, isKnownBank, isKnownBucket, BANK_LABELS, BUCKET_LABELS,
} from '../features/finance.js';
import { dashboardConfigured } from '../lib/firestore.js';
import { isAuthorized } from '../lib/access.js';
import { scheduleExpire, cancelExpire } from '../lib/expire.js';

/** Like interaction.update(), but also keeps the Focus card's "don't expire"
 *  property in sync with whatever this edit just put on screen — leaving
 *  Focus for another card resumes the normal 1-minute countdown from now. */
async function updateView(interaction, view, { persistent = false } = {}) {
  await interaction.update(view);
  if (persistent) cancelExpire(interaction.message);
  else scheduleExpire(interaction.message);
}

function amountModal(action, bankKey, bucketKey) {
  const input = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel(`${action === 'deposit' ? 'Deposit' : 'Withdraw'} amount (EGP)`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('500')
    .setRequired(true);
  const title = bucketKey === 'none'
    ? `${BANK_LABELS[bankKey]} · ${action === 'deposit' ? 'Deposit' : 'Withdraw'}`
    : `${BANK_LABELS[bankKey]} → ${BUCKET_LABELS[bucketKey]}`;
  return new ModalBuilder()
    .setCustomId(`finance:modal:${action}:${bankKey}:${bucketKey}`)
    .setTitle(title)
    .addComponents(new ActionRowBuilder().addComponents(input));
}

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id === 'bommy:home') return updateView(interaction, buildHubView());
  if (id === 'bommy:water') return updateView(interaction, await buildWaterView());
  if (id === 'bommy:focus') return updateView(interaction, await buildFocusView(), { persistent: true });
  if (id === 'bommy:finance') return updateView(interaction, await buildFinanceHomeView());

  if (id === 'water:add') { await addGlass(); return updateView(interaction, await buildWaterView()); }
  if (id === 'water:late') {
    const result = await addLateGlass();
    await updateView(interaction, await buildWaterView());
    if (!result.ok) await interaction.followUp({ content: result.message, ephemeral: true });
    return;
  }
  if (id === 'water:undo') { await undoGlass(); return updateView(interaction, await buildWaterView()); }
  if (id === 'water:fridayoptin') { await optInFriday(); return updateView(interaction, await buildWaterView()); }

  if (id === 'focus:refresh') return updateView(interaction, await buildFocusView(), { persistent: true });

  if (id === 'focus:done') {
    const result = await doneFocusRemote();
    await updateView(interaction, await buildFocusView(), { persistent: true });
    if (result.ok) {
      // Same "session logged" notice the System itself posts on every real
      // save — not ephemeral, not auto-expired, exactly like the real one.
      await interaction.channel.send({ embeds: [buildSessionLoggedNotice(result.focusGained, result.overtimeSeconds)] }).catch(() => {});
    } else {
      await interaction.followUp({ content: result.message, ephemeral: true });
    }
    return;
  }

  const focusAction = {
    'focus:start': startFocusRemote,
    'focus:pause': pauseFocusRemote,
    'focus:resume': resumeFocusRemote,
    'focus:discard': discardFocusRemote,
    'focus:skipbreak': skipBreakFocusRemote,
  }[id];
  if (focusAction) {
    const result = await focusAction();
    await updateView(interaction, await buildFocusView(), { persistent: true });
    if (!result.ok) await interaction.followUp({ content: result.message, ephemeral: true });
    return;
  }

  if (id === 'finance:home') return updateView(interaction, await buildFinanceHomeView());
  if (id === 'finance:banks') return updateView(interaction, await buildBanksView());
  if (id === 'finance:buckets') return updateView(interaction, await buildBucketsView());
  if (id.startsWith('finance:bank:')) {
    const key = id.split(':')[2];
    if (isKnownBank(key)) return updateView(interaction, await buildBankView(key));
  }
  if (id.startsWith('finance:deposit:') || id.startsWith('finance:withdraw:')) {
    const [, action, key] = id.split(':');
    if (isKnownBank(key)) return updateView(interaction, await buildBucketChoiceView(action, key));
  }
  if (id.startsWith('finance:amount:')) {
    const [, , action, bankKey, bucketKey] = id.split(':');
    if (isKnownBank(bankKey) && (bucketKey === 'none' || isKnownBucket(bucketKey))) {
      return interaction.showModal(amountModal(action, bankKey, bucketKey));
    }
  }
}

async function handleModal(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('finance:modal:')) return;

  const [, , action, bankKey, bucketKey] = id.split(':');
  const raw = interaction.fields.getTextInputValue('amount').replace(/,/g, '').trim();
  const amount = Number(raw);
  const result = await applyBankChange(bankKey, action, amount, bucketKey === 'none' ? null : bucketKey);

  if (!result.ok) {
    // A modal can't be replied to with a normal content+components edit of its
    // parent message and an ephemeral note at once in one call, so the error
    // goes out as its own ephemeral reply and the card underneath is left as-is.
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }
  await interaction.update(await buildBankView(bankKey));
}

const OUR_NAMESPACES = ['bommy:', 'water:', 'focus:', 'finance:'];

/** Whether this interaction belongs to the dashboard-control panel at all — other
 *  commands/buttons on this same bot application must pass through untouched. */
function isOurs(interaction) {
  if (interaction.isChatInputCommand()) {
    return commands.some((c) => c.data.name === interaction.commandName);
  }
  if (interaction.isButton() || interaction.isModalSubmit()) {
    return OUR_NAMESPACES.some((ns) => interaction.customId?.startsWith(ns));
  }
  return false;
}

export async function routeInteraction(interaction) {
  if (!isOurs(interaction)) return; // not one of ours — leave it alone entirely

  try {
    if (!(await isAuthorized(interaction))) {
      // Deliberately vague — doesn't confirm whether the command exists, the
      // channel is right, or who's allowed, so there's nothing to probe.
      await interaction.reply({ content: 'Not available here.', ephemeral: true }).catch(() => {});
      return;
    }
    if (!dashboardConfigured() && !interaction.isChatInputCommand()) {
      await interaction.reply({ content: 'Dashboard control isn\'t set up yet.', ephemeral: true }).catch(() => {});
      return;
    }
    if (interaction.isChatInputCommand()) {
      const command = commands.find((c) => c.data.name === interaction.commandName);
      if (command) await command.execute(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    const payload = { content: 'Something went wrong — try again.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
}

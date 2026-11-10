import { describe, expect, it } from 'vitest';
import { CONTROL_CHANNEL_ID } from '../config.js';
import { isAuthorized } from './access.js';

const guild = { ownerId: 'owner-1' };
const interaction = (over = {}) => ({
  channelId: CONTROL_CHANNEL_ID,
  guildId: 'g1',
  guild,
  user: { id: 'owner-1' },
  client: { guilds: { fetch: async () => guild } },
  ...over,
});

describe('isAuthorized — who may press the bot\'s buttons', () => {
  it('lets the server owner, in the control channel', async () => {
    expect(await isAuthorized(interaction())).toBe(true);
  });
  it('refuses anyone else, even in the right channel (the cards are visible to the whole channel)', async () => {
    expect(await isAuthorized(interaction({ user: { id: 'someone-else' } }))).toBe(false);
  });
  it('refuses the owner in any other channel', async () => {
    expect(await isAuthorized(interaction({ channelId: 'other' }))).toBe(false);
  });
  it('refuses direct messages', async () => {
    expect(await isAuthorized(interaction({ guildId: null }))).toBe(false);
  });
  it('fetches the server when the interaction does not carry it', async () => {
    expect(await isAuthorized(interaction({ guild: undefined }))).toBe(true);
  });
  it('refuses when the server cannot be fetched', async () => {
    expect(await isAuthorized(interaction({ guild: undefined, client: { guilds: { fetch: async () => { throw new Error('nope'); } } } }))).toBe(false);
  });
});

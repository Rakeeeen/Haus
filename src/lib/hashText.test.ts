import { describe, expect, it } from 'vitest';
import { emailHash, sha256Hex } from '@/lib/hashText';

describe('sha256Hex', () => {
  it('is the standard SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('emailHash', () => {
  it('ignores capitals and stray spaces, as a person would type it', async () => {
    expect(await emailHash('  Someone@Example.COM ')).toBe(await emailHash('someone@example.com'));
  });
  it('is null for no email', async () => {
    expect(await emailHash(null)).toBeNull();
    expect(await emailHash('')).toBeNull();
  });
});

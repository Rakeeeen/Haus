import { describe, it, expect } from 'vitest';
import { firstNameOf, isValidEmail, normalizeEmail, roleOf } from '@/domain/access';

describe('roleOf', () => {
  const invited = { email: 'a@b.co', active: true };
  it('is the owner for the owner uid, invited or not', () => {
    expect(roleOf('me', 'me', null)).toBe('owner');
    expect(roleOf('me', 'me', invited)).toBe('owner');
  });
  it('is a guest for an active invitation', () => {
    expect(roleOf('x', 'me', invited)).toBe('guest');
  });
  it('is none for a switched-off invitation', () => {
    expect(roleOf('x', 'me', { ...invited, active: false })).toBe('none');
  });
  it('is none with no invitation', () => {
    expect(roleOf('x', 'me', null)).toBe('none');
  });
});

describe('normalizeEmail / isValidEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Omar@Gmail.COM ')).toBe('omar@gmail.com');
  });
  it('accepts an email and rejects what is not one', () => {
    expect(isValidEmail('omar@gmail.com')).toBe(true);
    expect(isValidEmail(' Omar@Gmail.com ')).toBe(true);
    expect(isValidEmail('omar')).toBe(false);
    expect(isValidEmail('omar@gmail')).toBe(false);
    expect(isValidEmail('a b@c.co')).toBe(false);
  });
});

describe('firstNameOf', () => {
  it('takes the first word of the Google name', () => {
    expect(firstNameOf('Basmala Ahmed Ali')).toBe('Basmala');
    expect(firstNameOf('  Omar  ')).toBe('Omar');
  });
  it('keeps an Arabic name', () => {
    expect(firstNameOf('بسملة أحمد')).toBe('بسملة');
  });
  it('falls back to the email, then to a plain word', () => {
    expect(firstNameOf(null, 'omar.khaled@gmail.com')).toBe('Omar');
    expect(firstNameOf('', undefined)).toBe('Friend');
  });
});

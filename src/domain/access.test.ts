import { describe, it, expect } from 'vitest';
import {
  CODE_LENGTH, GUEST_APPROVAL_DAYS, codeFromBytes, firstNameOf, formatCode, isApprovalValid,
  isValidEmail, normalizeCode, normalizeEmail, roleOf, secondsLeft,
} from '@/domain/access';

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

describe('codeFromBytes', () => {
  it('makes CODE_LENGTH digits', () => {
    expect(codeFromBytes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('12345678');
    expect(codeFromBytes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toHaveLength(CODE_LENGTH);
  });
  it('reduces a byte to its last digit', () => {
    expect(codeFromBytes([123, 249, 100, 17, 42, 8, 99, 200])).toBe('39072890');
  });
  it('skips bytes that would favour the low digits', () => {
    expect(codeFromBytes([255, 250, 1, 2, 3, 4, 5, 6, 7, 8])).toBe('12345678');
  });
  it('refuses to make a code from too few usable bytes', () => {
    expect(() => codeFromBytes([1, 2, 3])).toThrow();
    expect(() => codeFromBytes([255, 255, 255, 255, 255, 255, 255, 255, 255])).toThrow();
  });
});

describe('typing a code', () => {
  it('keeps only the digits, up to its length', () => {
    expect(normalizeCode('4829 1037')).toBe('48291037');
    expect(normalizeCode('48-29 10x37 99')).toBe('48291037');
  });
  it('reads Arabic-Indic, Persian and full-width digits as the same code', () => {
    expect(normalizeCode('٤٨٢٩ ١٠٣٧')).toBe('48291037');
    expect(normalizeCode('۴۸۲۹۱۰۳۷')).toBe('48291037');
    expect(normalizeCode('４８２９１０３７')).toBe('48291037');
    expect(normalizeCode('٤٨٢٩ 1037')).toBe('48291037');
  });
  it('shows a code in two groups', () => {
    expect(formatCode('48291037')).toBe('4829 1037');
    expect(formatCode('4829')).toBe('4829');
  });
});

describe('isApprovalValid', () => {
  const day = 24 * 60 * 60 * 1000;
  it('holds for GUEST_APPROVAL_DAYS, not past', () => {
    expect(isApprovalValid(0, GUEST_APPROVAL_DAYS * day - 1)).toBe(true);
    expect(isApprovalValid(0, GUEST_APPROVAL_DAYS * day)).toBe(false);
  });
});

describe('secondsLeft', () => {
  it('rounds up and never goes below zero', () => {
    expect(secondsLeft(10_500, 10_000)).toBe(1);
    expect(secondsLeft(10_000, 12_000)).toBe(0);
  });
});

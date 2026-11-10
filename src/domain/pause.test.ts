import { describe, expect, it } from 'vitest';
import { MAX_PAUSE_MESSAGE, pauseOf } from '@/domain/pause';

describe('pauseOf', () => {
  it('is not paused when there is nothing, or something odd', () => {
    expect(pauseOf(null)).toEqual({ paused: false, message: '' });
    expect(pauseOf({ paused: 'yes' })).toEqual({ paused: false, message: '' });
  });
  it('is paused only for a real true, and carries the message', () => {
    expect(pauseOf({ paused: true, message: '  Back at 9  ' })).toEqual({ paused: true, message: 'Back at 9' });
  });
  it('keeps a message within its limit, and ignores one that is not text', () => {
    expect(pauseOf({ paused: true, message: 'x'.repeat(500) }).message).toHaveLength(MAX_PAUSE_MESSAGE);
    expect(pauseOf({ paused: true, message: 5 }).message).toBe('');
  });
});

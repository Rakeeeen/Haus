// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SwipeRow } from '@/ui/SwipeRow';

const setup = (props: Partial<React.ComponentProps<typeof SwipeRow>> = {}, width = 400) => {
  const onDelete = vi.fn();
  render(<SwipeRow onDelete={onDelete} {...props}><p>Write the report</p></SwipeRow>);
  const row = screen.getByText('Write the report').parentElement!.parentElement!;
  Object.defineProperty(row, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(row, 'offsetHeight', { value: 48, configurable: true });
  return { row, onDelete };
};
/** Wheel steps as a trackpad sends them: one about every 16 ms (a swipe is judged on its speed too, so the spacing matters). */
const feed = async (row: HTMLElement, deltas: number[], gap = 16) => {
  for (const d of deltas) {
    fireEvent.wheel(row, { deltaX: d, deltaY: 0 });
    await act(async () => { vi.advanceTimersByTime(gap); });
  }
};
const settleUp = async () => {
  await act(async () => { vi.advanceTimersByTime(400); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
};
/** A two-finger swipe to the left of `total` px at an unhurried pace, then the fingers stop. */
const swipe = async (row: HTMLElement, total: number, steps = 10) => {
  await feed(row, Array(steps).fill(total / steps), 30);
  await settleUp();
};

describe('SwipeRow, with the trackpad', () => {
  // The page's clock only moves forward; each test starts well after the one before, as a new swipe would.
  let clock = 0;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    clock += 100_000;
    vi.setSystemTime(clock);
    vi.advanceTimersByTime(clock);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('deletes when the swipe goes past halfway', async () => {
    const { row, onDelete } = setup();
    await swipe(row, 260);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('eases back, deleting nothing, when it is let go before halfway', async () => {
    const { row, onDelete } = setup();
    await swipe(row, 90);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('ignores a mostly vertical scroll', async () => {
    const { row, onDelete } = setup();
    for (let i = 0; i < 10; i++) { fireEvent.wheel(row, { deltaX: 20, deltaY: 60 }); await act(async () => { vi.advanceTimersByTime(16); }); }
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('ignores a swipe to the right', async () => {
    const { row, onDelete } = setup();
    await swipe(row, -300);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('does nothing when it is switched off', async () => {
    const { row, onDelete } = setup({ enabled: false });
    await swipe(row, 400);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("lets go where the fingers did: the momentum that follows doesn't carry it past the line", async () => {
    const { row, onDelete } = setup();
    // 100 px with the fingers, then the Mac coasts on with steps that only shrink (which would add up to far more).
    await feed(row, [8, 10, 12, 12, 10, 8], 30);      // about 60 px, at a steady pace
    await feed(row, [9, 8, 7, 6, 5, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);   // then the coasting, which would add up to far more
    await settleUp();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('a quick flick deletes from a short way', async () => {
    const { row, onDelete } = setup();
    await feed(row, [20, 28, 30, 22], 12);   // ~100 px in about 50 ms
    await settleUp();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('takes a second swipe after the first has settled back', async () => {
    const { row, onDelete } = setup();
    await swipe(row, 80);
    await act(async () => { vi.advanceTimersByTime(600); });
    await swipe(row, 260);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('is cancelled by a change of mind: pulled past the line, then drawn back before letting go', async () => {
    const { row, onDelete } = setup();
    await feed(row, [30, 40, 40, 40, 40, 40, 40]);     // 270 px, past the line
    await feed(row, [-25, -30, -30]);                   // back towards where it started
    await settleUp();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('leaves a swipe to the right alone, so the browser can take it as "back"', () => {
    const { row } = setup();
    const event = new WheelEvent('wheel', { deltaX: -40, deltaY: 0, cancelable: true, bubbles: true });
    row.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not hold the first steps of a swipe back before it is recognised', () => {
    const { row } = setup();
    const first = new WheelEvent('wheel', { deltaX: 2, deltaY: 0, cancelable: true, bubbles: true });
    row.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(false);
  });

  it("does not carry a swipe's momentum on to the row that takes the deleted one's place", async () => {
    const onDeleteA = vi.fn(), onDeleteB = vi.fn();
    render(<><SwipeRow onDelete={onDeleteA}><p>First</p></SwipeRow><SwipeRow onDelete={onDeleteB}><p>Second</p></SwipeRow></>);
    const rowA = screen.getByText('First').parentElement!.parentElement!;
    const rowB = screen.getByText('Second').parentElement!.parentElement!;
    for (const r of [rowA, rowB]) { Object.defineProperty(r, 'offsetWidth', { value: 400, configurable: true }); Object.defineProperty(r, 'offsetHeight', { value: 48, configurable: true }); }
    await feed(rowA, [30, 40, 50, 50, 50, 40, 30]);                                   // the swipe, over the first row
    await feed(rowA, [24, 20, 16, 12, 9, 7, 5]);                                      // then the Mac coasts: delivered to the first row...
    await feed(rowB, [24, 20, 16, 12, 9, 7, 5, 4, 3]);                                // ...then to the next row, which has slid up under the pointer
    await feed(rowB, Array(10).fill(40));                                               // and the momentum goes on, strong
    await settleUp();
    expect(onDeleteA).toHaveBeenCalledTimes(1);
    expect(onDeleteB).not.toHaveBeenCalled();
  });

  it('is not cut short by a steady drag after a fast start', async () => {
    const { row, onDelete } = setup();
    await feed(row, [40, 30, 20, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15], 20);   // still moving at 15 a step: not momentum
    await feed(row, [15, 15, 15, 15], 20);
    await settleUp();
    expect(onDelete).toHaveBeenCalledTimes(1);   // ~290 px: it was followed all the way, past the line
  });
});

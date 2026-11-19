import type { ThndrEntry, ThndrFlow } from '@/domain/finance/types';

// Thndr's share of the Future fund. A reading is what it holds at a moment (the form saves one each
// time it is changed by hand); a flow is money moved in or out by the older Thndr screen — flows saved
// after the latest reading still count, so nothing already stored is lost.

const byTimeAsc = (a: ThndrEntry, b: ThndrEntry) => a.timestamp.localeCompare(b.timestamp);

/** The readings oldest first. */
export const thndrSeries = (entries: ThndrEntry[]): ThndrEntry[] => [...entries].sort(byTimeAsc);

/** What a flow does to the total: a deposit adds, a withdrawal subtracts, a transfer between parts changes nothing. */
const signedAmount = (flow: ThndrFlow) => (flow.type === 'deposit' ? flow.amount : flow.type === 'withdraw' ? -flow.amount : 0);

/** Net money put in (negative: taken out) by the flows after `afterIso` (exclusive); all of them when null. */
export function netFlows(flows: ThndrFlow[], afterIso: string | null): number {
  return flows.filter((f) => afterIso === null || f.timestamp > afterIso).reduce((sum, f) => sum + signedAmount(f), 0);
}

/** What Thndr holds now: the latest reading plus whatever flowed since. With no readings yet, the net of the flows. */
export function currentThndrValue(entries: ThndrEntry[], flows: ThndrFlow[]): number {
  const series = thndrSeries(entries);
  const latest = series[series.length - 1];
  return latest ? latest.value + netFlows(flows, latest.timestamp) : Math.max(0, netFlows(flows, null));
}

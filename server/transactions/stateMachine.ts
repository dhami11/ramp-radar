import type { EventOutcome, Status } from '../../shared/api';

const RANK: Record<Status, number> = { new: 0, pending: 1, paid: 2, completed: 3, failed: 3, canceled: 3 };

export const isTerminal = (status: Status): boolean => RANK[status] === 3;

/**
 * Webhooks can arrive late or out of order. A transaction only ever moves
 * forward, and once it reaches a terminal status nothing changes it.
 * Exact repeats (same transaction and status) are caught earlier, by the store.
 */
export function decide(current: Status | undefined, incoming: Status): EventOutcome {
  if (current === undefined) return 'applied';
  if (isTerminal(current)) return 'stale';
  return RANK[incoming] > RANK[current] ? 'applied' : 'stale';
}

import { afterAll, describe, expect, it } from 'vitest';
import { decide } from '../server/transactions/stateMachine';
import { TransactionStore } from '../server/transactions/store';

describe('decide', () => {
  it.each([
    [undefined, 'paid', 'applied'],
    ['pending', 'paid', 'applied'],
    ['paid', 'failed', 'applied'],
    ['paid', 'pending', 'stale'],
    ['completed', 'failed', 'stale'],
    ['canceled', 'completed', 'stale'],
  ] as const)('%s → %s is %s', (current, incoming, expected) => {
    expect(decide(current, incoming)).toBe(expected);
  });
});

describe('TransactionStore', () => {
  const store = new TransactionStore();
  afterAll(() => store.close());

  it('applies forward moves, ignores repeats and keeps late events for the record', () => {
    expect(store.record({ transactionId: 't1', status: 'new', onramp: 'banxa', inAmount: 250 })).toBe('applied');
    expect(store.record({ transactionId: 't1', status: 'paid' })).toBe('applied');
    expect(store.record({ transactionId: 't1', status: 'paid' })).toBe('duplicate');
    expect(store.record({ transactionId: 't1', status: 'pending' })).toBe('stale');
    expect(store.record({ transactionId: 't1', status: 'completed', transactionHash: '0xabc' })).toBe('applied');

    const { transaction, events } = store.get('t1')!;
    expect(transaction).toMatchObject({
      status: 'completed',
      onramp: 'banxa', // kept, although later events left it out
      inAmount: 250,
      transactionHash: '0xabc',
    });
    expect(events.map((e) => [e.status, e.outcome])).toEqual([
      ['new', 'applied'],
      ['paid', 'applied'],
      ['pending', 'stale'],
      ['completed', 'applied'],
    ]);
  });
});

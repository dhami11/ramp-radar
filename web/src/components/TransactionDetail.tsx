import { useEffect, useState } from 'react';
import { api, type Status, type TransactionDetailResponse, type TransactionEvent } from '../lib/api';
import { clock } from '../lib/format';

type StepState = 'done' | 'late' | 'missed' | 'waiting';

const TERMINAL: Status[] = ['completed', 'failed', 'canceled'];

const STEP_NOTE: Record<StepState, string> = {
  done: '',
  late: 'arrived late, ignored',
  missed: 'not received',
  waiting: 'waiting',
};

/** The lifecycle of one transaction, built from the events the store kept. */
export function TransactionDetail({ id, revision }: { id: string; revision: number }) {
  const [detail, setDetail] = useState<TransactionDetailResponse>();

  useEffect(() => {
    api<TransactionDetailResponse>(`/api/transactions/${id}`).then(setDetail, () => undefined);
  }, [id, revision]);

  if (!detail) return null;
  const { transaction, events } = detail;

  // Show the terminal step the transaction actually reached, or `completed` while it is in flight.
  const path: Status[] = [
    'new',
    'pending',
    'paid',
    TERMINAL.includes(transaction.status) ? transaction.status : 'completed',
  ];
  const reached = path.indexOf(transaction.status);

  return (
    <div className="detail">
      <ol className="lifecycle">
        {path.map((status, index) => {
          const event = events.find((e) => e.status === status);
          const state = stepState(event, index < reached);
          return (
            <li key={status} className={`step is-${state} status-${status}`}>
              <span className="step-mark" aria-hidden />
              <span className="step-name">{status}</span>
              <span className="step-note mono">
                {state === 'done' && event ? clock(event.receivedAt) : STEP_NOTE[state]}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="kv">
        <div>
          <dt>Wallet</dt>
          <dd>{transaction.walletAddress ?? '—'}</dd>
        </div>
        <div>
          <dt>Tx hash</dt>
          <dd>{transaction.transactionHash ?? <span className="muted">not on-chain yet</span>}</dd>
        </div>
      </dl>
    </div>
  );
}

function stepState(event: TransactionEvent | undefined, passed: boolean): StepState {
  if (event?.outcome === 'applied') return 'done';
  if (event?.outcome === 'stale') return 'late';
  return passed ? 'missed' : 'waiting';
}

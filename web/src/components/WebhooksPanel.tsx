import { useCallback, useEffect, useState } from 'react';
import { useEventSource } from '../hooks/useEventSource';
import { api, type Delivery, type DeliveryResult, type InboxResponse } from '../lib/api';
import { clock } from '../lib/format';
import { providerName } from '../lib/providers';
import { TransactionDetail } from './TransactionDetail';

type Tone = 'good' | 'warn' | 'bad';

const RESULTS: Record<DeliveryResult, { label: string; tone: Tone; explains: string }> = {
  applied: { label: 'Applied', tone: 'good', explains: 'Moved the transaction forward' },
  duplicate: { label: 'Duplicate', tone: 'warn', explains: 'Already processed, so acknowledged and ignored' },
  stale: { label: 'Out of order', tone: 'warn', explains: 'Older than the current status, so logged but not applied' },
  rejected: { label: 'Rejected', tone: 'bad', explains: 'Signature did not match; answered 401' },
  invalid: { label: 'Invalid', tone: 'bad', explains: 'Signed, but not a valid payload; answered 400' },
};

const TALLY: DeliveryResult[] = ['applied', 'duplicate', 'stale', 'rejected'];
const LOG_ROWS = 14;
/** Upper bound on a replay; the button normally re-enables when the final delivery lands. */
const REPLAY_TIMEOUT_MS = 15_000;

export function WebhooksPanel({ demoEnabled }: { demoEnabled: boolean }) {
  const [inbox, setInbox] = useState<InboxResponse>();
  const [openId, setOpenId] = useState<string>();
  const [replayingId, setReplayingId] = useState<string>();
  const [revision, setRevision] = useState(0); // bumps per delivery so an open transaction refetches

  const refresh = useCallback(() => {
    api<InboxResponse>('/api/inbox').then(setInbox, () => undefined);
  }, []);

  useEffect(refresh, [refresh]);

  const live = useEventSource<Delivery>('/api/inbox/stream', 'delivery', (delivery) => {
    if (delivery.transactionId === replayingId && delivery.status === 'completed') setReplayingId(undefined);
    setRevision((r) => r + 1);
    refresh();
  });

  useEffect(() => {
    if (!replayingId) return;
    const timer = setTimeout(() => setReplayingId(undefined), REPLAY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [replayingId]);

  async function replay() {
    const { transactionId } = await api<{ transactionId: string }>('/api/demo/webhooks', {});
    setReplayingId(transactionId);
    setOpenId(transactionId);
  }

  const received = inbox ? Object.values(inbox.counts).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <section className="panel" aria-labelledby="inbox-title">
      <div className="panel-head">
        <div>
          <h2 id="inbox-title">Webhook inbox</h2>
          <p>
            Each delivery is checked against its HMAC signature before it is read. Repeats and late arrivals never move
            a transaction backwards.
          </p>
        </div>
        <div className="panel-actions">
          <span className={live ? 'live is-on' : 'live'} role="status">
            {live ? 'Listening' : 'Connecting…'}
          </span>
          {demoEnabled && (
            <button className="btn btn-primary" onClick={replay} disabled={replayingId !== undefined}>
              {replayingId ? 'Replaying…' : 'Replay a messy delivery'}
            </button>
          )}
        </div>
      </div>

      <dl className="tally">
        <div>
          <dt>Received</dt>
          <dd>{received}</dd>
        </div>
        {TALLY.map((result) => (
          <div key={result} className={`tone-${RESULTS[result].tone}`}>
            <dt>{RESULTS[result].label}</dt>
            <dd>{inbox?.counts[result] ?? 0}</dd>
          </div>
        ))}
      </dl>

      <div className="inbox">
        <section className="inbox-col" aria-labelledby="log-title">
          <h3 id="log-title" className="col-title">
            Delivery log
          </h3>
          {inbox?.deliveries.length ? (
            <DeliveryLog deliveries={inbox.deliveries.slice(0, LOG_ROWS)} />
          ) : (
            <p className="empty">
              No deliveries yet.
              {demoEnabled && ' Replay a messy delivery to send six signed webhooks, one of them forged.'}
            </p>
          )}
        </section>

        <section className="inbox-col" aria-labelledby="txn-title">
          <h3 id="txn-title" className="col-title">
            Transactions
          </h3>
          {inbox?.transactions.length ? (
            <ul className="txns">
              {inbox.transactions.map((t) => {
                const open = openId === t.id;
                return (
                  <li key={t.id} className={open ? 'is-open' : undefined}>
                    <button className="txn" aria-expanded={open} onClick={() => setOpenId(open ? undefined : t.id)}>
                      <span className="mono">{t.id}</span>
                      <span className="txn-route">
                        {providerName(t.onramp)} · {t.inAmount} {t.sourceCurrency?.toUpperCase()} → {t.outAmount}{' '}
                        {t.targetCurrency?.toUpperCase()}
                      </span>
                      <span className={`status status-${t.status}`}>{t.status}</span>
                    </button>
                    {open && <TransactionDetail id={t.id} revision={revision} />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">Transactions appear here once a valid webhook arrives.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function DeliveryLog({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <div className="table-wrap">
      <table className="log">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Result</th>
            <th scope="col">Event</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id} title={RESULTS[d.result].explains}>
              <td className="mono muted">{clock(d.at)}</td>
              <td>
                <span className={`result tone-${RESULTS[d.result].tone}`}>{RESULTS[d.result].label}</span>
              </td>
              <td className="mono">
                {d.status ? (
                  <>
                    {d.status} <span className="muted">{d.transactionId}</span>
                  </>
                ) : (
                  <span className="muted">
                    {d.result === 'rejected' ? 'signature mismatch, body not read' : 'malformed payload'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

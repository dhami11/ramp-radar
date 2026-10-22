import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { EventOutcome, Status, Transaction, TransactionDetailResponse, TransactionEvent } from '../../shared/api';
import type { WebhookEvent } from '../onramper/webhook';
import { decide } from './stateMachine';

export type RecordOutcome = EventOutcome | 'duplicate';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS transactions (
    id               TEXT PRIMARY KEY,
    status           TEXT NOT NULL,
    onramp           TEXT,
    source_currency  TEXT,
    target_currency  TEXT,
    in_amount        REAL,
    out_amount       REAL,
    payment_method   TEXT,
    wallet_address   TEXT,
    transaction_hash TEXT,
    partner_context  TEXT,
    status_date      TEXT,
    updated_at       TEXT NOT NULL
  );

  -- Append-only log of every distinct (transaction, status) event received.
  -- The unique key is what turns a redelivered webhook into a no-op.
  CREATE TABLE IF NOT EXISTS events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL,
    status         TEXT NOT NULL,
    status_date    TEXT,
    outcome        TEXT NOT NULL,
    received_at    TEXT NOT NULL,
    payload        TEXT NOT NULL,
    UNIQUE (transaction_id, status)
  );
`;

interface TransactionRow {
  id: string;
  status: Status;
  onramp: string | null;
  source_currency: string | null;
  target_currency: string | null;
  in_amount: number | null;
  out_amount: number | null;
  payment_method: string | null;
  wallet_address: string | null;
  transaction_hash: string | null;
  partner_context: string | null;
  status_date: string | null;
  updated_at: string;
}

interface EventRow {
  id: number;
  status: Status;
  status_date: string | null;
  outcome: EventOutcome;
  received_at: string;
}

export class TransactionStore {
  private readonly db: DatabaseSync;
  private readonly sql: Record<'currentStatus' | 'insertEvent' | 'upsert' | 'list' | 'get' | 'events', StatementSync>;

  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    // WAL lets readers proceed during a write; busy_timeout makes a second process wait instead of failing.
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);

    this.sql = {
      currentStatus: this.db.prepare('SELECT status FROM transactions WHERE id = ?'),
      insertEvent: this.db.prepare(
        `INSERT INTO events (transaction_id, status, status_date, outcome, received_at, payload)
         VALUES (:transactionId, :status, :statusDate, :outcome, :receivedAt, :payload)
         ON CONFLICT (transaction_id, status) DO NOTHING`,
      ),
      // Later events often omit fields an earlier one carried (the hash only arrives
      // on completion), so a missing value never overwrites a known one.
      upsert: this.db.prepare(
        `INSERT INTO transactions (id, status, onramp, source_currency, target_currency, in_amount, out_amount,
                                   payment_method, wallet_address, transaction_hash, partner_context, status_date, updated_at)
         VALUES (:transactionId, :status, :onramp, :sourceCurrency, :targetCurrency, :inAmount, :outAmount,
                 :paymentMethod, :walletAddress, :transactionHash, :partnerContext, :statusDate, :updatedAt)
         ON CONFLICT (id) DO UPDATE SET
           status           = excluded.status,
           onramp           = COALESCE(excluded.onramp, onramp),
           source_currency  = COALESCE(excluded.source_currency, source_currency),
           target_currency  = COALESCE(excluded.target_currency, target_currency),
           in_amount        = COALESCE(excluded.in_amount, in_amount),
           out_amount       = COALESCE(excluded.out_amount, out_amount),
           payment_method   = COALESCE(excluded.payment_method, payment_method),
           wallet_address   = COALESCE(excluded.wallet_address, wallet_address),
           transaction_hash = COALESCE(excluded.transaction_hash, transaction_hash),
           partner_context  = COALESCE(excluded.partner_context, partner_context),
           status_date      = excluded.status_date,
           updated_at       = excluded.updated_at`,
      ),
      list: this.db.prepare('SELECT * FROM transactions ORDER BY updated_at DESC LIMIT ?'),
      get: this.db.prepare('SELECT * FROM transactions WHERE id = ?'),
      events: this.db.prepare(
        'SELECT id, status, status_date, outcome, received_at FROM events WHERE transaction_id = ? ORDER BY id',
      ),
    };
  }

  /**
   * Records one verified webhook event and reports what it did. Read, decide and
   * write share one transaction, so processes sharing the file can't interleave.
   */
  record(event: WebhookEvent, receivedAt = new Date().toISOString()): RecordOutcome {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.sql.currentStatus.get(event.transactionId) as { status: Status } | undefined;
      const outcome = decide(current?.status, event.status);

      const { changes } = this.sql.insertEvent.run({
        transactionId: event.transactionId,
        status: event.status,
        statusDate: event.statusDate ?? null,
        outcome,
        receivedAt,
        payload: JSON.stringify(event),
      });
      if (changes === 0) {
        this.db.exec('COMMIT');
        return 'duplicate';
      }

      if (outcome === 'applied') {
        this.sql.upsert.run({
          transactionId: event.transactionId,
          status: event.status,
          onramp: event.onramp ?? null,
          sourceCurrency: event.sourceCurrency ?? null,
          targetCurrency: event.targetCurrency ?? null,
          inAmount: event.inAmount ?? null,
          outAmount: event.outAmount ?? null,
          paymentMethod: event.paymentMethod ?? null,
          walletAddress: event.walletAddress ?? null,
          transactionHash: event.transactionHash ?? null,
          partnerContext: event.partnerContext ?? null,
          statusDate: event.statusDate ?? null,
          updatedAt: receivedAt,
        });
      }
      this.db.exec('COMMIT');
      return outcome;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  list(limit = 50): Transaction[] {
    return (this.sql.list.all(limit) as unknown as TransactionRow[]).map(toTransaction);
  }

  get(id: string): TransactionDetailResponse | undefined {
    const row = this.sql.get.get(id) as unknown as TransactionRow | undefined;
    if (!row) return undefined;
    const events = (this.sql.events.all(id) as unknown as EventRow[]).map(toEvent);
    return { transaction: toTransaction(row), events };
  }

  close(): void {
    this.db.close();
  }
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    status: row.status,
    onramp: row.onramp ?? undefined,
    sourceCurrency: row.source_currency ?? undefined,
    targetCurrency: row.target_currency ?? undefined,
    inAmount: row.in_amount ?? undefined,
    outAmount: row.out_amount ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    walletAddress: row.wallet_address ?? undefined,
    transactionHash: row.transaction_hash ?? undefined,
    partnerContext: row.partner_context ?? undefined,
    statusDate: row.status_date ?? undefined,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: EventRow): TransactionEvent {
  return {
    id: row.id,
    status: row.status,
    outcome: row.outcome,
    statusDate: row.status_date ?? undefined,
    receivedAt: row.received_at,
  };
}

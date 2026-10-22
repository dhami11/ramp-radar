// The HTTP contract between server/ and web/. Both sides import these types,
// so a change to a response shape fails the type check on both ends.

export type Mode = 'live' | 'mock';

/** Onramper transaction lifecycle: new → pending → paid → completed | failed | canceled. */
export const STATUSES = ['new', 'pending', 'paid', 'completed', 'failed', 'canceled'] as const;
export type Status = (typeof STATUSES)[number];

export interface RankedQuote {
  ramp: string;
  paymentMethod: string;
  /** Crypto received after all fees. */
  payout: number;
  rate: number;
  networkFee: number;
  transactionFee: number;
  /** Fiat paid per unit of crypto received, fees included. */
  effectivePrice: number;
  /** Shortfall against the best quote in basis points (1 bp = 0.01%); 0 for the best. */
  behindBestBps: number;
  recommendations: string[];
  quoteId?: string;
}

export interface UnavailableQuote {
  ramp: string;
  errorId?: number;
  reason: string;
}

export interface QuotesResponse {
  mode: Mode;
  query: { fiat: string; crypto: string; amount: number };
  fetchedAt: string;
  cached: boolean;
  ranked: RankedQuote[];
  unavailable: UnavailableQuote[];
}

export interface CheckoutRequest {
  onramp: string;
  fiat: string;
  crypto: string;
  amount: number;
  paymentMethod: string;
  network: string;
  walletAddress: string;
}

export interface CheckoutResponse {
  mode: Mode;
  partnerContext: string;
  session: { redirectUrl: string; sessionId: string };
  /** What was signed and sent (API key redacted), for inspection. */
  signature: { canonicalString: string; headers: Record<string, string> };
}

export interface Transaction {
  id: string;
  status: Status;
  onramp?: string;
  sourceCurrency?: string;
  targetCurrency?: string;
  inAmount?: number;
  outAmount?: number;
  paymentMethod?: string;
  walletAddress?: string;
  transactionHash?: string;
  partnerContext?: string;
  statusDate?: string;
  updatedAt: string;
}

export type EventOutcome = 'applied' | 'stale';

export interface TransactionEvent {
  id: number;
  status: Status;
  outcome: EventOutcome;
  statusDate?: string;
  receivedAt: string;
}

export interface TransactionDetailResponse {
  transaction: Transaction;
  events: TransactionEvent[];
}

/** What happened to one webhook delivery, including ones refused before they were read. */
export type DeliveryResult = EventOutcome | 'duplicate' | 'rejected' | 'invalid';

export interface Delivery {
  id: string;
  at: string;
  result: DeliveryResult;
  httpStatus: number;
  transactionId?: string;
  status?: Status;
}

export interface InboxResponse {
  transactions: Transaction[];
  deliveries: Delivery[];
  counts: Record<DeliveryResult, number>;
}

export interface ErrorResponse {
  error: string;
  requestId?: string;
}

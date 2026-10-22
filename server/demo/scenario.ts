import { randomUUID } from 'node:crypto';
import { computeWebhookSignature, type WebhookEvent } from '../onramper/webhook';
import type { Status } from '../../shared/api';

interface Step {
  label: string;
  status: Status;
  forged?: boolean;
  extra?: Partial<WebhookEvent>;
}

/** What a real webhook inbox sees on a bad day. */
export const MESSY_DELIVERY: Step[] = [
  { label: 'created', status: 'new' },
  { label: 'payment received', status: 'paid' },
  { label: 'redelivered "paid"', status: 'paid' },
  { label: 'late "pending" arrives', status: 'pending' }, // delayed in transit; must not move paid back
  { label: 'forged "completed"', status: 'completed', forged: true, extra: { walletAddress: 'attacker-wallet' } },
  { label: 'completed on-chain', status: 'completed' },
];

export interface StepResult {
  label: string;
  httpStatus: number;
  outcome: string;
}

export function newDemoTransactionId(): string {
  return `demo_${randomUUID().slice(0, 8)}`;
}

export async function runScenario(options: {
  url: string;
  secret: string;
  transactionId?: string;
  delayMs?: number;
  onStep?: (result: StepResult) => void;
}): Promise<StepResult[]> {
  const transactionId = options.transactionId ?? newDemoTransactionId();
  const base: WebhookEvent = {
    transactionId,
    status: 'new',
    onramp: 'banxa',
    onrampTransactionId: `bx_${randomUUID().slice(0, 12)}`,
    sourceCurrency: 'eur',
    targetCurrency: 'btc',
    inAmount: 250,
    outAmount: 0.00265,
    paymentMethod: 'creditcard',
    transactionType: 'buy',
    walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    partnerContext: `rr_${randomUUID()}`,
  };

  const results: StepResult[] = [];
  for (const [index, step] of MESSY_DELIVERY.entries()) {
    if (index > 0 && options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));

    const isFinal = step.status === 'completed' && !step.forged;
    const event = {
      ...base,
      ...step.extra,
      status: step.status,
      statusDate: new Date().toISOString(),
      ...(isFinal && { transactionHash: `0x${randomUUID().replaceAll('-', '')}` }),
    };
    const body = JSON.stringify(event);
    const signature = computeWebhookSignature(body, step.forged ? 'not-the-secret' : options.secret);

    const response = await fetch(options.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Onramper-Webhook-Signature': signature },
      body,
    });
    const reply = (await response.json()) as { outcome?: string; error?: string };
    const result = { label: step.label, httpStatus: response.status, outcome: reply.outcome ?? reply.error ?? '?' };
    results.push(result);
    options.onStep?.(result);
  }
  return results;
}

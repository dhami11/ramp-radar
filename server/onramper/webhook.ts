import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { STATUSES } from '../../shared/api';

// https://docs.onramper.com/docs/optional-webhook-setup
export const WEBHOOK_SIGNATURE_HEADER = 'x-onramper-webhook-signature';

export function computeWebhookSignature(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Verifies against the raw bytes Onramper sent. Re-serializing parsed JSON can
 * change key order or whitespace and break the HMAC, so never verify a parsed body.
 */
export function verifyWebhookSignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(computeWebhookSignature(rawBody, secret), 'hex');
  const received = Buffer.from(header.trim().toLowerCase(), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export const webhookEventSchema = z.object({
  transactionId: z.string().min(1),
  status: z.enum(STATUSES),
  statusDate: z.string().optional(),
  onramp: z.string().optional(),
  onrampTransactionId: z.string().optional(),
  sourceCurrency: z.string().optional(),
  targetCurrency: z.string().optional(),
  inAmount: z.number().optional(),
  outAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  walletAddress: z.string().optional(),
  transactionHash: z.string().optional(),
  transactionType: z.string().optional(),
  partnerContext: z.string().optional(),
  country: z.string().optional(),
  partnerFee: z.number().optional(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

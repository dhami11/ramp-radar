import { z } from 'zod';

const currency = z
  .string()
  .regex(/^[a-z]{3}$/i, 'Use a 3-letter currency code, e.g. EUR')
  .transform((s) => s.toLowerCase());

const asset = z
  .string()
  .regex(/^[a-z0-9_]{2,20}$/i, 'Use an Onramper asset id, e.g. btc or usdc_ethereum')
  .transform((s) => s.toLowerCase());

const amount = z.number().positive().max(50_000);

export const quoteQuerySchema = z.object({
  fiat: currency,
  crypto: asset,
  amount: z.coerce.number().pipe(amount),
  paymentMethod: z
    .string()
    .regex(/^[a-z0-9_]+$/i)
    .optional(),
  country: z.string().length(2).optional(),
});

export const checkoutRequestSchema = z.object({
  onramp: z.string().regex(/^[a-z0-9_]+$/i),
  fiat: currency,
  crypto: asset,
  amount,
  paymentMethod: z.string().regex(/^[a-z0-9_]+$/i),
  network: z.string().regex(/^[a-z0-9_]+$/i),
  walletAddress: z.string().trim().min(20).max(128),
});

/** The first validation problem, phrased for a person. */
export const firstIssue = (error: z.ZodError): string => {
  const issue = error.issues[0];
  return issue ? `${issue.path.join('.') || 'request'}: ${issue.message}` : 'Invalid request';
};

import { randomUUID } from 'node:crypto';
import type { OnramperQuote, QuoteQuery } from './types';

// Rough reference prices so mock quotes look plausible. Not market data.
const PRICES_EUR: Record<string, number> = { btc: 92_000, eth: 3_400, usdc: 0.93, usdt: 0.93, sol: 160 };
const FIAT_PER_EUR: Record<string, number> = { eur: 1, usd: 1.08, gbp: 0.85 };

// Spread (as a fraction of price) and flat fee in EUR per provider.
const PROVIDERS = [
  { ramp: 'moonpay', spread: 0.012, fee: 3.99 },
  { ramp: 'banxa', spread: 0.009, fee: 2.5 },
  { ramp: 'transak', spread: 0.01, fee: 2.99 },
  { ramp: 'mercuryo', spread: 0.008, fee: 4.5 },
  { ramp: 'guardarian', spread: 0.015, fee: 1.0 },
] as const;

export function mockQuotes({ fiat, crypto, amount, paymentMethod = 'creditcard' }: QuoteQuery): OnramperQuote[] {
  const priceEur = PRICES_EUR[crypto];
  const fiatPerEur = FIAT_PER_EUR[fiat];
  if (priceEur === undefined || fiatPerEur === undefined) return [];

  const price = priceEur * fiatPerEur;
  const networkFee = (crypto === 'btc' ? 1.2 : crypto === 'eth' ? 0.9 : 0.1) * fiatPerEur;

  const quotes: OnramperQuote[] = PROVIDERS.map(({ ramp, spread, fee }) => {
    const jitter = 1 + (Math.random() - 0.5) * 0.004;
    const rate = price * (1 + spread) * jitter;
    const transactionFee = fee * fiatPerEur;
    const payout = Math.max(0, (amount - transactionFee - networkFee) / rate);
    return {
      ramp,
      paymentMethod,
      rate: round(rate, 2),
      networkFee: round(networkFee, 2),
      transactionFee: round(transactionFee, 2),
      payout: round(payout, 8),
      quoteId: randomUUID(),
    };
  });

  // Onramper tags quotes; mimic its BestPrice label on the highest payout.
  const best = quotes.reduce((a, b) => ((b.payout ?? 0) > (a.payout ?? 0) ? b : a));
  best.recommendations = ['BestPrice'];
  const banxa = quotes.find((q) => q.ramp === 'banxa');
  if (banxa) banxa.recommendations = [...(banxa.recommendations ?? []), 'LowKyc'];

  quotes.push({
    ramp: 'alchemypay',
    paymentMethod,
    quoteId: randomUUID(),
    errors: [{ type: 'NoSupportedPaymentFound', errorId: 6103, message: 'No supported payments found' }],
  });
  return quotes;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

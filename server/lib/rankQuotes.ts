import type { RankedQuote, UnavailableQuote } from '../../shared/api';
import type { OnramperQuote } from '../onramper/types';

type PricedQuote = OnramperQuote & { payout: number };

const isPriced = (quote: OnramperQuote): quote is PricedQuote =>
  !quote.errors?.length && typeof quote.payout === 'number' && quote.payout > 0;

/**
 * Orders quotes by crypto received after fees, the number a buyer actually cares
 * about. Providers that returned an error are reported separately, not ranked.
 */
export function rankQuotes(
  quotes: OnramperQuote[],
  amount: number,
): { ranked: RankedQuote[]; unavailable: UnavailableQuote[] } {
  const priced = quotes.filter(isPriced).sort((a, b) => b.payout - a.payout);
  const best = priced[0]?.payout ?? 0;

  const ranked = priced.map((quote): RankedQuote => ({
    ramp: quote.ramp,
    paymentMethod: quote.paymentMethod,
    payout: quote.payout,
    rate: quote.rate ?? 0,
    networkFee: quote.networkFee ?? 0,
    transactionFee: quote.transactionFee ?? 0,
    effectivePrice: amount / quote.payout,
    behindBestBps: (1 - quote.payout / best) * 10_000,
    recommendations: quote.recommendations ?? [],
    quoteId: quote.quoteId,
  }));

  const unavailable = quotes
    .filter((quote) => !isPriced(quote))
    .map((quote): UnavailableQuote => ({
      ramp: quote.ramp,
      errorId: quote.errors?.[0]?.errorId,
      reason: quote.errors?.[0]?.message ?? 'No payout offered',
    }));

  return { ranked, unavailable };
}

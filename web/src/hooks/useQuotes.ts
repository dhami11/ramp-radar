import { useCallback, useEffect, useState } from 'react';
import { api, type QuotesResponse } from '../lib/api';

export interface QuoteParams {
  amount: number;
  fiat: string;
  asset: string;
}

interface QuotesState {
  quotes?: QuotesResponse;
  error?: string;
  loading: boolean;
}

/** Ranked quotes for `initial` on mount; `load` runs a new search and keeps the last result on screen meanwhile. */
export function useQuotes(initial: QuoteParams) {
  const [state, setState] = useState<QuotesState>({ loading: true });

  const fetchQuotes = useCallback(async ({ amount, fiat, asset }: QuoteParams) => {
    const params = new URLSearchParams({ fiat, crypto: asset, amount: String(amount) });
    try {
      const quotes = await api<QuotesResponse>(`/api/quotes?${params}`);
      setState({ quotes, loading: false });
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message, loading: false }));
    }
  }, []);

  const load = useCallback(
    (params: QuoteParams) => {
      setState((s) => ({ ...s, error: undefined, loading: true }));
      return fetchQuotes(params);
    },
    [fetchQuotes],
  );

  const [initialParams] = useState(initial);
  useEffect(() => {
    void fetchQuotes(initialParams);
  }, [fetchQuotes, initialParams]);

  return { ...state, load };
}

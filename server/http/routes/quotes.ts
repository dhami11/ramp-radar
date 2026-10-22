import { Router, type Response } from 'express';
import type { ErrorResponse, QuotesResponse } from '../../../shared/api';
import { rankQuotes } from '../../lib/rankQuotes';
import { TtlCache } from '../../lib/ttlCache';
import type { OnramperClient } from '../../onramper/client';
import { firstIssue, quoteQuerySchema } from '../schemas';

export function quotesRouter({ client, cacheMs = 30_000 }: { client: OnramperClient; cacheMs?: number }): Router {
  const router = Router();
  // Quotes move slowly relative to how often a page asks; a short cache spares Onramper's rate limits.
  const cache = new TtlCache<Omit<QuotesResponse, 'cached'>>(cacheMs);

  router.get('/api/quotes', async (req, res: Response<QuotesResponse | ErrorResponse>) => {
    const parsed = quoteQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
    const query = parsed.data;

    const key = JSON.stringify(query);
    const cached = cache.get(key);
    if (cached) return res.json({ ...cached, cached: true });

    const quotes = await client.getQuotes(query);
    const body = {
      mode: client.mode,
      query: { fiat: query.fiat, crypto: query.crypto, amount: query.amount },
      fetchedAt: new Date().toISOString(),
      ...rankQuotes(quotes, query.amount),
    };
    cache.set(key, body);
    res.json({ ...body, cached: false });
  });

  return router;
}

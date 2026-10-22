import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CheckoutResponse, InboxResponse, QuotesResponse, TransactionDetailResponse } from '../shared/api';
import { runScenario } from '../server/demo/scenario';
import { SECRET, startTestServer } from './helpers';

let server: Awaited<ReturnType<typeof startTestServer>>;
beforeAll(async () => {
  server = await startTestServer();
});
afterAll(() => server.close());

describe('GET /api/quotes', () => {
  it('ranks by crypto received and lists providers that could not quote', async () => {
    const body = (await (await server.get('/api/quotes?fiat=EUR&crypto=btc&amount=250')).json()) as QuotesResponse;

    const payouts = body.ranked.map((q) => q.payout);
    expect(payouts).toEqual([...payouts].sort((a, b) => b - a));
    expect(body.ranked[0]!.behindBestBps).toBe(0);
    expect(body.ranked.at(-1)!.behindBestBps).toBeGreaterThan(0);
    expect(body.unavailable).toContainEqual(expect.objectContaining({ ramp: 'alchemypay', errorId: 6103 }));
  });

  it('serves a repeat request from cache', async () => {
    await server.get('/api/quotes?fiat=eur&crypto=eth&amount=100');
    const again = (await (await server.get('/api/quotes?fiat=eur&crypto=eth&amount=100')).json()) as QuotesResponse;
    expect(again.cached).toBe(true);
  });

  it('explains what is wrong with a bad query', async () => {
    const response = await server.get('/api/quotes?fiat=euro&crypto=btc&amount=10');
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/^fiat: Use a 3-letter currency code/);
  });
});

describe('POST /api/checkout', () => {
  const request = {
    onramp: 'banxa',
    fiat: 'eur',
    crypto: 'btc',
    amount: 250,
    paymentMethod: 'creditcard',
    network: 'bitcoin',
    walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  };

  it('returns a session and the signed request, without the resume token', async () => {
    const response = await server.post('/api/checkout', request);
    const body = (await response.json()) as CheckoutResponse;

    expect(response.status).toBe(200);
    expect(body.signature.headers['x-onramper-signature']).toMatch(/^v2:/);
    expect(body.signature.canonicalString.split('\n')[4]).toBe('/checkout/v2/intent');
    expect(body.session.redirectUrl).toContain(body.session.sessionId);
    expect(body.session).not.toHaveProperty('resumeToken');
  });

  it('answers malformed JSON with 400, not 500', async () => {
    const response = await server.post('/api/checkout', '{"onramp":');
    expect(response.status).toBe(400);
  });
});

describe('POST /webhooks/onramper', () => {
  it('treats a redelivery as a no-op and refuses a forged delivery', async () => {
    const event = { transactionId: 'h1', status: 'paid' };
    expect(await (await server.sendWebhook(event)).json()).toEqual({ outcome: 'applied' });
    expect(await (await server.sendWebhook(event)).json()).toEqual({ outcome: 'duplicate' });
    expect((await server.sendWebhook({ transactionId: 'h1', status: 'completed' }, 'wrong')).status).toBe(401);

    const detail = (await (await server.get('/api/transactions/h1')).json()) as TransactionDetailResponse;
    expect(detail.transaction.status).toBe('paid');
  });

  it('rejects a well-signed payload with an unknown status', async () => {
    expect((await server.sendWebhook({ transactionId: 'h2', status: 'teleported' })).status).toBe(400);
  });

  it('survives the messy delivery scenario end to end', async () => {
    const results = await runScenario({
      url: `${server.baseUrl}/webhooks/onramper`,
      secret: SECRET,
      transactionId: 'm1',
    });
    expect(results.map((r) => [r.httpStatus, r.outcome])).toEqual([
      [200, 'applied'],
      [200, 'applied'],
      [200, 'duplicate'],
      [200, 'stale'],
      [401, 'Signature does not match'],
      [200, 'applied'],
    ]);

    const detail = (await (await server.get('/api/transactions/m1')).json()) as TransactionDetailResponse;
    expect(detail.transaction.status).toBe('completed');
    expect(detail.transaction.walletAddress).not.toBe('attacker-wallet');

    const inbox = (await (await server.get('/api/inbox')).json()) as InboxResponse;
    expect(inbox.counts.rejected).toBeGreaterThanOrEqual(1);
    expect(inbox.deliveries[0]).toMatchObject({ result: 'applied', transactionId: 'm1', status: 'completed' });
  });
});

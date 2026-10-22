import type { AddressInfo } from 'node:net';
import { createApp, type AppDeps } from '../server/http/app';
import { createMockClient } from '../server/onramper/client';
import { computeWebhookSignature } from '../server/onramper/webhook';
import { TransactionStore } from '../server/transactions/store';

export const SECRET = 'test-webhook-secret';

/** Starts the app on a random port with an in-memory store and the mock Onramper client. */
export async function startTestServer(overrides: Partial<AppDeps> = {}) {
  const store = new TransactionStore();
  const app = createApp({ client: createMockClient(), store, webhookSecret: SECRET, demoDelayMs: 0, ...overrides });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    baseUrl,
    get: (path: string) => fetch(`${baseUrl}${path}`),
    post: (path: string, body: unknown) =>
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    sendWebhook: (payload: object, secret = SECRET) => {
      const body = JSON.stringify(payload);
      return fetch(`${baseUrl}/webhooks/onramper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Onramper-Webhook-Signature': computeWebhookSignature(body, secret),
        },
        body,
      });
    },
    close: () => {
      server.close();
      store.close();
    },
  };
}

import { generateKeyPairSync, randomUUID, type KeyLike } from 'node:crypto';
import type { Mode } from '../../shared/api';
import { log } from '../lib/logger';
import { mockQuotes } from './fixtures';
import { canonicalQuery, signRequestV2, type SignedRequest } from './signV2';
import type { CheckoutIntentBody, CheckoutIntentResponse, OnramperQuote, QuoteQuery } from './types';

export class OnramperError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OnramperError';
  }
}

export interface SignedCheckout {
  session: CheckoutIntentResponse;
  /** What was signed and sent, with the API key redacted. */
  signature: { canonicalString: string; headers: Record<string, string> };
}

export interface OnramperClient {
  readonly mode: Mode;
  getQuotes(query: QuoteQuery): Promise<OnramperQuote[]>;
  createCheckoutIntent(body: CheckoutIntentBody): Promise<SignedCheckout>;
}

const CHECKOUT_PATH = '/checkout/v2/intent';

function signCheckout(apiKey: string, privateKey: KeyLike, body: CheckoutIntentBody): SignedRequest {
  return signRequestV2({ method: 'POST', path: CHECKOUT_PATH, apiKey, privateKey, body });
}

function inspection(signed: SignedRequest): SignedCheckout['signature'] {
  const { Authorization = '', ...rest } = signed.headers;
  return {
    canonicalString: signed.canonicalString,
    headers: { Authorization: `${Authorization.slice(0, 8)}…`, ...rest },
  };
}

export function createLiveClient(options: {
  apiKey: string;
  baseUrl: string;
  privateKey?: KeyLike;
  timeoutMs?: number;
}): OnramperClient {
  const { apiKey, baseUrl, privateKey, timeoutMs = 5000 } = options;

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      throw new OnramperError(timedOut ? `Onramper did not respond within ${timeoutMs}ms` : 'Could not reach Onramper');
    }
    if (!response.ok) {
      // The body can be long or carry internals; log it, but keep the client-facing message short.
      log('warn', 'onramper error response', {
        path,
        status: response.status,
        body: (await response.text()).slice(0, 500),
      });
      throw new OnramperError(`Onramper answered ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  }

  return {
    mode: 'live',

    async getQuotes({ fiat, crypto, ...params }) {
      const query = canonicalQuery({ ...params, type: 'buy', platform: 'web' });
      const data = await request<unknown>(`/quotes/${fiat}/${crypto}?${query}`, { headers: { Authorization: apiKey } });
      // With no providers available Onramper answers { message: "No providers available" }.
      return Array.isArray(data) ? (data as OnramperQuote[]) : [];
    },

    async createCheckoutIntent(body) {
      if (!privateKey) throw new OnramperError('Checkout needs ONRAMPER_SIGNING_KEY_FILE to be set');
      const signed = signCheckout(apiKey, privateKey, body);
      // Send the exact bytes that were hashed, never a re-serialization.
      const session = await request<CheckoutIntentResponse>(CHECKOUT_PATH, {
        method: 'POST',
        headers: signed.headers,
        body: signed.bodyText,
      });
      return { session, signature: inspection(signed) };
    },
  };
}

/**
 * Runs without an API key. Quotes come from fixtures; checkout requests are still
 * signed for real (with a throwaway key), so the signing path is exercised.
 */
export function createMockClient(): OnramperClient {
  const { privateKey } = generateKeyPairSync('ed25519');

  return {
    mode: 'mock',

    async getQuotes(query) {
      return mockQuotes(query);
    },

    async createCheckoutIntent(body) {
      const signed = signCheckout('pk_test_SAMPLE', privateKey, body);
      const sessionId = randomUUID();
      return {
        session: {
          redirectUrl: `https://buy.onramper.dev/checkout?sessionId=${sessionId}`,
          sessionId,
          resumeToken: randomUUID().replaceAll('-', ''),
        },
        signature: inspection(signed),
      };
    },
  };
}

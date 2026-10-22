import { createHash, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../server/onramper/canonicalJson';
import {
  buildCanonicalString,
  canonicalQuery,
  EMPTY_BODY_SHA256,
  signRequestV2,
  verifySignatureV2,
} from '../server/onramper/signV2';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

describe('canonicalize (RFC 8785)', () => {
  it('sorts keys at every level and drops whitespace', () => {
    expect(canonicalize({ b: 1, a: { d: [3, { z: true, y: null }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}',
    );
  });

  it('serializes numbers the ECMAScript way', () => {
    expect(canonicalize([1.0, 1e21, 0.000001, -0])).toBe('[1,1e+21,0.000001,0]');
  });

  it('omits undefined members and rejects non-finite numbers', () => {
    expect(canonicalize({ a: undefined, b: 2 })).toBe('{"b":2}');
    expect(() => canonicalize({ a: Number.NaN })).toThrow();
  });
});

describe('Signature V2 canonical string', () => {
  it('has the documented 8 parts in order', () => {
    const lines = buildCanonicalString({
      timestamp: '2024-01-15T10:30:00.000Z',
      nonce: '6b1f7b4e-1f0a-4c1e-9f57-2c8f0c3a9d11',
      method: 'post',
      path: '/checkout/v2/intent',
      query: { z: 1, a: 'b c' },
      apiKey: ' pk_test_abc ',
      contentType: 'application/json',
      bodyText: '{"a":1}',
    }).split('\n');

    expect(lines).toEqual([
      'ONRAMPER-SIG-V2',
      '2024-01-15T10:30:00.000Z',
      '6b1f7b4e-1f0a-4c1e-9f57-2c8f0c3a9d11',
      'POST',
      '/checkout/v2/intent',
      'a=b+c&z=1',
      'authorization:pk_test_abc',
      'content-type:application/json',
      createHash('sha256').update('{"a":1}').digest('hex'),
    ]);
  });

  it('uses an empty query line and the empty-body hash for a bare GET', () => {
    const lines = buildCanonicalString({
      timestamp: 't',
      nonce: 'n',
      method: 'GET',
      path: '/supported',
      apiKey: 'pk_test_abc',
    }).split('\n');
    expect(lines[5]).toBe('');
    expect(lines.at(-1)).toBe(EMPTY_BODY_SHA256);
  });

  it('skips undefined query values', () => {
    expect(canonicalQuery({ b: undefined, a: 1 })).toBe('a=1');
  });
});

describe('signRequestV2', () => {
  const body = { wallet: { address: 'bc1q' }, amount: 100, onramp: 'banxa' };
  const signed = signRequestV2({
    method: 'POST',
    path: '/checkout/v2/intent',
    apiKey: 'pk_test_abc',
    privateKey,
    body,
  });

  it('produces a signature the public key verifies', () => {
    expect(signed.headers['x-onramper-signature']).toMatch(/^v2:/);
    expect(verifySignatureV2(signed.canonicalString, signed.headers['x-onramper-signature']!, publicKey)).toBe(true);
  });

  it('sends the same canonical bytes it hashed', () => {
    expect(signed.bodyText).toBe('{"amount":100,"onramp":"banxa","wallet":{"address":"bc1q"}}');
    expect(signed.headers['Content-Type']).toBe('application/json');
  });

  it('fails verification if any byte of the request changes', () => {
    const tampered = signed.canonicalString.replace('POST', 'PUT');
    expect(verifySignatureV2(tampered, signed.headers['x-onramper-signature']!, publicKey)).toBe(false);
  });

  it('uses a fresh nonce per request', () => {
    const again = signRequestV2({ method: 'POST', path: '/x', apiKey: 'k', privateKey, body });
    expect(again.headers['x-onramper-nonce']).not.toBe(signed.headers['x-onramper-nonce']);
  });
});

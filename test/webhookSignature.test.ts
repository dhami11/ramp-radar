import { describe, expect, it } from 'vitest';
import { computeWebhookSignature, verifyWebhookSignature } from '../server/onramper/webhook';

const SECRET = 'whsec_test';
const body = Buffer.from('{"transactionId":"t1","status":"paid"}');
const signature = computeWebhookSignature(body, SECRET);

describe('verifyWebhookSignature', () => {
  it('accepts the right HMAC in either case', () => {
    expect(verifyWebhookSignature(body, signature, SECRET)).toBe(true);
    expect(verifyWebhookSignature(body, signature.toUpperCase(), SECRET)).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['signed with another secret', computeWebhookSignature(body, 'other')],
    ['truncated', signature.slice(0, 40)],
    ['not hex', 'zz'.repeat(32)],
  ])('rejects a signature that is %s', (_case, header) => {
    expect(verifyWebhookSignature(body, header, SECRET)).toBe(false);
  });

  it('rejects a body changed after signing', () => {
    const tampered = Buffer.from(body.toString().replace('paid', 'completed'));
    expect(verifyWebhookSignature(tampered, signature, SECRET)).toBe(false);
  });
});

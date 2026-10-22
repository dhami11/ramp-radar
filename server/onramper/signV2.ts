import { createHash, randomUUID, sign, verify, type KeyLike } from 'node:crypto';
import { canonicalize } from './canonicalJson';

// Onramper "Signature V2": an Ed25519 signature over an 8-line canonical string.
// https://docs.onramper.com/docs/api-sign-requests-v2

export const SIGNATURE_VERSION = 'ONRAMPER-SIG-V2';
export const EMPTY_BODY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface CanonicalParts {
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  query?: QueryParams;
  apiKey: string;
  contentType?: string;
  bodyText?: string;
}

export interface SignRequestInput {
  method: string;
  path: string;
  query?: QueryParams;
  apiKey: string;
  privateKey: KeyLike;
  /** Objects are sent as RFC 8785 canonical JSON; strings are sent as-is. */
  body?: unknown;
  timestamp?: string;
  nonce?: string;
}

export interface SignedRequest {
  headers: Record<string, string>;
  bodyText?: string;
  canonicalString: string;
}

export function canonicalQuery(query: QueryParams = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }
  params.sort();
  return params.toString();
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function buildCanonicalString(parts: CanonicalParts): string {
  const headers = [`authorization:${parts.apiKey.trim()}`];
  if (parts.contentType) headers.push(`content-type:${parts.contentType.trim()}`);
  headers.sort();

  return [
    SIGNATURE_VERSION,
    parts.timestamp,
    parts.nonce,
    parts.method.toUpperCase(),
    parts.path,
    canonicalQuery(parts.query),
    headers.join('\n'),
    sha256Hex(parts.bodyText ?? ''),
  ].join('\n');
}

export function signRequestV2(input: SignRequestInput): SignedRequest {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const nonce = input.nonce ?? randomUUID();

  let bodyText: string | undefined;
  let contentType: string | undefined;
  if (input.body !== undefined) {
    const isJson = typeof input.body !== 'string';
    bodyText = isJson ? canonicalize(input.body) : (input.body as string);
    contentType = isJson ? 'application/json' : 'text/plain';
  }

  const canonicalString = buildCanonicalString({
    timestamp,
    nonce,
    method: input.method,
    path: input.path,
    query: input.query,
    apiKey: input.apiKey,
    contentType,
    bodyText,
  });
  const signature = sign(null, Buffer.from(canonicalString, 'utf8'), input.privateKey).toString('base64');

  const headers: Record<string, string> = {
    Authorization: input.apiKey,
    'x-onramper-signature': `v2:${signature}`,
    'x-onramper-timestamp': timestamp,
    'x-onramper-nonce': nonce,
  };
  if (contentType) headers['Content-Type'] = contentType;

  return { headers, bodyText, canonicalString };
}

/** Mirrors what Onramper does on its side; used in tests and the signature inspector. */
export function verifySignatureV2(canonicalString: string, signatureHeader: string, publicKey: KeyLike): boolean {
  if (!signatureHeader.startsWith('v2:')) return false;
  const signature = Buffer.from(signatureHeader.slice(3), 'base64');
  return verify(null, Buffer.from(canonicalString, 'utf8'), publicKey, signature);
}

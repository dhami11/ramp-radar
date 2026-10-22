// RFC 8785 (JSON Canonicalization Scheme) for plain JSON values.
// ECMAScript's JSON.stringify already serializes strings and numbers the way
// JCS requires; what it adds is sorted keys (by UTF-16 code units) and no whitespace.
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('Non-finite numbers cannot be represented in JSON');
    }
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError(`Cannot canonicalize a ${typeof value}`);
    return serialized;
  }

  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;

  const record = value as Record<string, unknown>;
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${members.join(',')}}`;
}

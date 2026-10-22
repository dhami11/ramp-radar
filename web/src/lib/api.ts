export type * from '../../../shared/api';

/** GET when there is no body, POST with JSON otherwise. Throws the server's error message on failure. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = (json as { error?: string } | undefined)?.error;
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }
  return json as T;
}

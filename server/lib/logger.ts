type Level = 'info' | 'warn' | 'error';

const silent = process.env.NODE_ENV === 'test';

/** One JSON object per line, so logs stay greppable and machine-readable. */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (silent) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === 'info') console.log(line);
  else console[level](line);
}

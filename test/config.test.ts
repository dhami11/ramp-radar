import { describe, expect, it } from 'vitest';
import { loadConfig } from '../server/config';

describe('loadConfig', () => {
  it('runs on sample data without a key and treats empty values as unset', () => {
    const config = loadConfig({ ONRAMPER_API_KEY: '', ONRAMPER_API_URL: '' });
    expect(config).toMatchObject({ mode: 'mock', ONRAMPER_API_URL: 'https://api-stg.onramper.com', PORT: 8787 });
  });

  it('switches to live mode when a key is present', () => {
    expect(loadConfig({ ONRAMPER_API_KEY: 'pk_test_x' }).mode).toBe('live');
  });

  it('refuses to start with a bad value', () => {
    expect(() => loadConfig({ ONRAMPER_API_URL: 'not a url' })).toThrow(/Invalid configuration/);
  });
});

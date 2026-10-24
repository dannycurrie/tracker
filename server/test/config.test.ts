import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const valid = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'secret',
  API_KEY: 'a'.repeat(32),
  USER_TZ: 'Europe/London',
};

describe('loadConfig', () => {
  it('loads a complete config', () => {
    expect(loadConfig(valid)).toEqual({
      ok: true,
      config: {
        supabaseUrl: valid.SUPABASE_URL,
        supabaseSecretKey: valid.SUPABASE_SECRET_KEY,
        apiKey: valid.API_KEY,
        timezone: 'Europe/London',
      },
    });
  });

  it('reports every missing or blank variable', () => {
    expect(loadConfig({ API_KEY: '  ' })).toEqual({
      ok: false,
      problems: [
        'SUPABASE_URL is not set',
        'SUPABASE_SECRET_KEY is not set',
        'API_KEY is not set',
        'USER_TZ is not set',
      ],
    });
  });

  it('rejects a short API key', () => {
    expect(loadConfig({ ...valid, API_KEY: 'short' })).toEqual({
      ok: false,
      problems: ['API_KEY must be at least 32 characters'],
    });
  });

  it('rejects an unknown timezone', () => {
    expect(loadConfig({ ...valid, USER_TZ: 'Mars/Olympus' })).toEqual({
      ok: false,
      problems: ['USER_TZ is not a valid IANA timezone'],
    });
  });
});

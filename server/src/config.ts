export interface Config {
  supabaseUrl: string;
  supabaseSecretKey: string;
  apiKey: string;
  timezone: string;
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; problems: string[] };

const MIN_API_KEY_LENGTH = 32;

export function loadConfig(env: Record<string, string | undefined>): ConfigResult {
  const problems: string[] = [];
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) problems.push(`${name} is not set`);
    return value ?? '';
  };

  const supabaseUrl = required('SUPABASE_URL');
  const supabaseSecretKey = required('SUPABASE_SECRET_KEY');
  const apiKey = required('API_KEY');
  const timezone = required('USER_TZ');

  if (apiKey && apiKey.length < MIN_API_KEY_LENGTH) {
    problems.push(`API_KEY must be at least ${MIN_API_KEY_LENGTH} characters`);
  }
  if (timezone && !isValidTimezone(timezone)) {
    problems.push(`USER_TZ is not a valid IANA timezone`);
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, config: { supabaseUrl, supabaseSecretKey, apiKey, timezone } };
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

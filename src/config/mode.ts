const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// Local mode activates when explicitly set, or when Supabase hasn't been configured yet.
export const isLocalMode =
  process.env.EXPO_PUBLIC_LOCAL_MODE === 'true' ||
  !url ||
  url === 'https://your-project-ref.supabase.co';

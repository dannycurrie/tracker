# Quickstart: Habit Metric Tracker

**Branch**: `001-habit-metric-tracker` | **Date**: 2026-04-26

## Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Xcode 15+ with iOS 16+ simulator
- Supabase account (free tier sufficient)

## 1. Bootstrap the Project

```bash
npx create-expo-app tracker --template blank-typescript
cd tracker
```

## 2. Install Core Dependencies

```bash
npx expo install expo-application expo-constants

npm install \
  @supabase/supabase-js \
  react-native-mmkv \
  @tanstack/react-query \
  zustand \
  @react-native-community/netinfo \
  react-native-uuid

# Expo-managed native modules
npx expo install expo-secure-store expo-crypto
```

## 3. Configure Supabase

1. Create a new Supabase project at supabase.com
2. Enable **Anonymous sign-ins**: Authentication > Providers > Anonymous
3. Run the schema from `specs/001-habit-metric-tracker/contracts/schema.sql` in the SQL editor
4. Copy your project URL and anon key

Create `src/services/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export default supabase;
```

Add to `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Anonymous Session Initialisation

In your app root, sign in anonymously once and persist the session:

```typescript
import supabase from './src/services/supabase';

async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await supabase.auth.signInAnonymously();
  }
}
```

## 5. Run the App

```bash
npx expo run:ios
```

## 6. Run Tests

```bash
npm test
```

## Key Implementation Notes

| Topic | Approach |
|-------|----------|
| Period value | Always derived from log entries — never stored. See `query-patterns.md`. |
| Timer | Store `started_at` timestamp in Zustand + MMKV. Elapsed = `Date.now() - started_at`. |
| Offline queue | MMKV key `offline_queue` (JSON array). Drain on NetInfo `isConnected` event. |
| Conflict safety | All log entry inserts use `ON CONFLICT (id) DO NOTHING`. Client assigns UUID. |
| RLS | Enforced via `auth.uid()`. Anonymous session provides the UID automatically. |

## Reference Docs

- [Data Model](data-model.md) — table schemas, local storage, aggregation rules
- [Query Patterns](contracts/query-patterns.md) — canonical Supabase queries
- [Database Schema](contracts/schema.sql) — DDL to deploy
- [Research](research.md) — architectural decisions and rationale

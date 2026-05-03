# Research: Apple Health Running Sync

**Branch**: `002-apple-health-sync` | **Phase**: 0

## Decision 1: HealthKit Library

**Decision**: Use `react-native-health`

**Rationale**: Most widely adopted HealthKit wrapper for React Native. Supports Expo prebuild workflow (requires native build — not Expo Go, which already applies to this project due to react-native-mmkv). Provides a `getWorkouts` query that returns workouts by type, date range, and unit, directly matching the sync requirements. The workout result includes `id` (the HKWorkout UUID), `distance`, `start`, and `end` fields.

**Alternatives considered**:
- `@kingstinct/react-native-healthkit` — better TypeScript types but smaller community and less workout query documentation. Not worth the tradeoff.
- Direct NativeModule bridge — unnecessary complexity given `react-native-health` is mature.

**Resolved**: NEEDS CLARIFICATION for HealthKit library → `react-native-health`

---

## Decision 2: Deduplication Strategy

**Decision**: Use the HealthKit workout UUID as the log entry `id`

**Rationale**: Every HKWorkout has a globally unique UUID (`id` field in `react-native-health`). The existing `insertLogEntry` service already uses `onConflict: 'id', ignoreDuplicates: true` on upsert. Passing the workout UUID as the log entry `id` gives deduplication for free — re-running the sync will simply no-op on already-inserted entries, with no additional tracking needed.

**Alternatives considered**:
- Maintaining a local set of synced UUIDs in MMKV — redundant given the upsert already handles this.
- Timestamp-based deduplication — less reliable; two workouts could end at the same millisecond.

**Resolved**: NEEDS CLARIFICATION for deduplication → workout UUID as log entry `id`

---

## Decision 3: Foreground Sync Trigger

**Decision**: React Native `AppState` API — listen for transitions to `'active'`

**Rationale**: React Native ships `AppState` as a built-in; no new dependency. When the app transitions to `'active'` (i.e. comes to foreground), trigger `syncRunningWorkouts()`. This satisfies FR-011 without any polling or background fetch complexity.

**Alternatives considered**:
- Background fetch / background tasks — significantly more complex, requires additional entitlements, and is not required since FR-011 only specifies foreground sync.
- Manual trigger button — ruled out per spec assumption (out of scope for v1).

**Resolved**: NEEDS CLARIFICATION for trigger mechanism → `AppState` foreground listener

---

## Decision 4: Sync Checkpoint Persistence

**Decision**: MMKV key `'health:last_sync_at'` storing an ISO 8601 timestamp string

**Rationale**: MMKV is already present in the project for the offline queue. A single string key is sufficient. After each successful sync batch, the checkpoint is updated to the `end` date of the most recently processed workout (sorted ascending). On first sync, the lookback is 90 days (per spec assumption).

**Alternatives considered**:
- Supabase — would require a network round-trip just to know where to start syncing; MMKV is faster and works offline.
- AsyncStorage — synchronous MMKV is preferable given the existing dependency.

**Resolved**: NEEDS CLARIFICATION for checkpoint storage → MMKV `'health:last_sync_at'`

---

## Decision 5: Unit Conversion

**Decision**: Request distances in `km` directly from `react-native-health`

**Rationale**: `react-native-health`'s `getWorkouts` accepts a `unit` option. Requesting `'km'` avoids manual conversion and rounding in application code. Zero-distance workouts (value < 0.001 km) are filtered out before insertion.

**Alternatives considered**:
- Request in meters and divide by 1000 — produces floating-point noise; requesting in km is cleaner.

**Resolved**: NEEDS CLARIFICATION for unit handling → request in `km`, filter < 0.001

---

## Decision 6: Running Distance Metric Auto-Creation

**Decision**: On first sync, query existing metrics for one named `'Running Distance'` (case-insensitive). If absent, create it via the existing `createMetric` service with type `'cumulative'` and timeframe `'weekly'`. Persist the metric `id` in MMKV under `'health:running_metric_id'` to avoid re-querying on every sync.

**Rationale**: Reuses existing `createMetric` and `fetchUserMetrics` services. Caching the metric ID in MMKV avoids a Supabase fetch on every foreground event.

**Resolved**: NEEDS CLARIFICATION for metric bootstrapping → auto-create + cache in MMKV

---

## Required App Configuration Changes

- Add `react-native-health` to `package.json` dependencies
- Add `NSHealthShareUsageDescription` to `app.json` `ios.infoPlist`
- Add `com.apple.developer.healthkit: true` to `app.json` `ios.entitlements`
- Re-run `expo prebuild` after these changes

# Research: Habit Metric Tracker

**Branch**: `001-habit-metric-tracker` | **Date**: 2026-04-26

## Decision Log

### 1. Offline Queue Implementation

**Decision**: Custom lightweight queue backed by MMKV + @react-native-community/netinfo

**Rationale**:
- Supabase JS client has no built-in offline sync capability
- MMKV provides synchronous, high-performance local storage — survives app restart without async overhead
- NetInfo emits reliable connectivity change events on iOS; the queue processor drains on `isConnected: true` events
- Log entries are append-only; no conflict resolution is needed beyond idempotency (client-assigned UUIDs)

**Alternatives Considered**:
- WatermelonDB with Supabase sync adapter — full offline-first DB, but adds ~4MB bundle size and significant complexity for a personal single-user app
- AsyncStorage — built-in but asynchronous and slower; acceptable but MMKV is the React Native community standard for performance-sensitive storage

---

### 2. Background Timer Strategy

**Decision**: Store the absolute timer start timestamp; derive elapsed time on foreground

**Rationale**:
- iOS severely restricts background CPU execution for non-audio/location apps
- A running counter is unnecessary: `elapsed = Date.now() - startedAt`
- On app foreground (`AppState` change to `active`), the hook recomputes elapsed from the stored timestamp
- The timer "continues" during background without any background execution — accurate to the millisecond when the user returns

**Alternatives Considered**:
- iOS Background Tasks API (via Expo) — adds entitlement complexity; Apple limits task duration to ~30 seconds anyway
- Storing elapsed and suspending the counter on background — loses accuracy; requires extra reconciliation on foreground

---

### 3. Period Value Derivation (No Stored current_value)

**Decision**: Current-period value is always computed by querying log entries within the active period window

**Rationale**:
- Storing a `current_value` column requires a scheduled reset job (weekly/monthly) and is fragile under offline conditions (offline entries from before a reset would be double-counted or lost)
- Derived approach: `SELECT SUM(value) FROM log_entries WHERE metric_id = ? AND logged_at >= period_start`
- For average metrics: `SELECT AVG(value) FROM log_entries WHERE ...`
- Period window is a pure function of the current date and the metric's timeframe, computed client-side
- Offline queue entries include their `logged_at` client timestamp, so they slot into the correct period when synced

**Alternatives Considered**:
- Cached `current_value` with Supabase Edge Function reset — easier read performance but complex reset scheduling and offline edge cases
- Rolling window (last 7 days / last 30 days) — simpler but inconsistent with calendar-week/calendar-month semantics the user expects

---

### 4. Authentication Strategy

**Decision**: Supabase anonymous authentication (auto-session, no login UI)

**Rationale**:
- App is strictly personal, single-user; no login screen is desired
- Supabase anonymous auth creates a persistent UUID session stored in the device keychain — survives app restarts
- Provides a stable `user_id` for future expansion (linking to email, multi-device sync) without changing the data model
- Row-level security can be enabled on Supabase tables scoped to `auth.uid()` without any user-facing auth flow

**Alternatives Considered**:
- No auth + public tables — simpler but exposes all data to anyone with the anon key; unsuitable even for personal use
- Hardcoded `user_id` UUID — works but non-standard and harder to migrate if auth is added later

---

### 5. State Management

**Decision**: TanStack Query v5 (server state) + Zustand (local UI state)

**Rationale**:
- TanStack Query handles fetching, caching, and background refetch of metrics and log entries from Supabase
- Zustand manages ephemeral client state: active timer start timestamps and the offline queue's in-memory representation
- MMKV persistence middleware for Zustand makes the queue and timer state survive app restarts

**Alternatives Considered**:
- Redux Toolkit — heavier boilerplate for a personal app of this scope
- React Context only — no caching, no background refetch, no request deduplication

---

### 6. Offline Sync Idempotency

**Decision**: Client-assigned UUIDs on all log entries; server uses `INSERT ... ON CONFLICT DO NOTHING`

**Rationale**:
- Each log entry is assigned a UUID by the client before being queued
- If the network fails mid-upload and the client retries, the server silently ignores duplicate IDs
- Guarantees exactly-once semantics without a separate deduplication table

**Alternatives Considered**:
- Server-assigned IDs only — requires a round-trip before queuing; incompatible with offline-first
- Timestamp-based deduplication — fragile under clock skew between devices

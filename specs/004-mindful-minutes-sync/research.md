# Research: Mindful Minutes Sync

**Branch**: `004-mindful-minutes-sync` | **Date**: 2026-05-05 | **Plan**: [plan.md](plan.md)

## Decision Log

### 1. HealthKit API for Mindful Sessions

**Decision**: `AppleHealthKit.getMindfulSession(options, callback)` — already present in the installed `react-native-health@^1.19.0` library.

**Rationale**: The library wraps `HKCategoryTypeIdentifierMindfulSession`. No additional install or native bridging needed.

**Key constraint discovered**: The native Objective-C implementation (`RCTAppleHealthKit+Methods_Mindfulness.m`) only returns `startDate` and `endDate` in each result object — it does **not** return the HK UUID or a `value` field. The TypeScript type declares `id?` as optional on `BaseValue`, confirming `id` will be `undefined` from this call.

**Alternatives considered**: Querying `HKCategoryType` samples directly via a custom native module — unnecessary given the library already covers this.

---

### 2. Session Duration Computation

**Decision**: Compute duration as `Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000)` in minutes. Filter out sessions where computed `durationMinutes < 1`.

**Rationale**: Mindful sessions in HealthKit are `HKCategorySample` objects. The native code does not return a `value` field representing duration — duration is implicitly `endDate − startDate`. The `value` field on `HKCategorySample` for mindful sessions is always `HKCategoryValueMindfulSessionNotApplicable (= 0)` and is meaningless.

**Alternatives considered**: Using the `value` field from the result — not viable; native code doesn't populate it.

---

### 3. Deduplication Key (no UUID available)

**Decision**: Use `startDate` ISO string as the log entry `id` (e.g., `"2026-05-05T07:30:00.000Z"`). Since mindful sessions cannot overlap in time, `startDate` uniquely identifies each session.

**Rationale**: The native API omits the `HKObjectUUID`. Constructing a stable key from `startDate` alone is sufficient because Apple Health prevents concurrent mindful sessions — each has a unique start time.

**Spec note**: FR-004 says "use the Apple Health session's unique identifier" — the closest available stable identifier without UUID is `startDate`, which is unique and immutable after a session is recorded.

**Alternatives considered**:
- `${startDate}:${endDate}` — more collision-resistant but `endDate` can change if a session is edited; `startDate` alone is immutable.
- `startDate` alone — chosen; simpler, immutable, guaranteed unique per session.

---

### 4. Result Sort Order

**Decision**: Sort results ascending by `startDate` in JavaScript after receiving them from `getMindfulSession`.

**Rationale**: The native implementation sorts by `endDate DESC` (hardcoded — `ascending: NO` in `NSSortDescriptor`). The `ascending` option in `HealthInputOptions` is ignored by this particular implementation. Ascending order is required to correctly advance the sync checkpoint to the last-processed session.

**Alternatives considered**: Relying on the native sort order — not viable; native returns descending, checkpoint advancement requires ascending.

---

### 5. HealthKit Permission

**Decision**: Add `AppleHealthKit.Constants.Permissions.MindfulSession` to the `read` array in `requestHealthPermission()`, alongside existing `Workout` and `SleepAnalysis`.

**Rationale**: Single `initHealthKit` call covers all three data types. No second permission prompt is needed.

**Alternatives considered**: Separate permission request — unnecessary complexity.

---

### 6. Sync Checkpoint Storage

**Decision**: New MMKV key `'mindful:last_sync_at'` in the existing `createKV('health-sync')` instance. Default on first sync: 90 days ago (reusing `NINETY_DAYS_MS` constant).

**Rationale**: Mirrors the pattern established for running (`health:last_sync_at`) and sleep (`sleep:last_sync_at`). No new storage instance needed.

---

### 7. Manual Resync Dispatch

**Decision**: Extend `syncEntriesForMetric(metricId, since)` in `resyncAppleHealthMetrics` to handle `MINDFUL_METRIC_ID`. After resync, reset checkpoint key `MINDFUL_LAST_SYNC_KEY` to `start.toISOString()`.

**Rationale**: Exact same pattern as the running and sleep dispatch added in feature 003. No new infrastructure needed.

---

## Summary Table

| Unknown | Decision |
|---------|----------|
| Mindful session API | `getMindfulSession` — in installed library |
| `id` field | Not returned by native — use `startDate` as dedup key |
| Duration field | Not returned — compute from `endDate − startDate` in ms |
| Sort order | Native is DESC; sort ascending in JS before checkpoint advance |
| Permission | Add `MindfulSession` to existing `initHealthKit` call |
| Checkpoint key | `'mindful:last_sync_at'` in existing MMKV instance |
| Manual resync | Extend `syncEntriesForMetric` by metric ID |

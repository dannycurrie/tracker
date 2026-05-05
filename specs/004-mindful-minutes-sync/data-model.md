# Data Model: Mindful Minutes Sync

**Branch**: `004-mindful-minutes-sync` | **Date**: 2026-05-05

## Entities

### RawMindfulSample

A single mindfulness session record returned by `getMindfulSession`. No `id` or `value` field is provided by the native API.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `startDate` | `string` | Apple Health / native | ISO 8601; used as dedup key; immutable after recording |
| `endDate` | `string` | Apple Health / native | ISO 8601; `endDate − startDate` = session duration |

```ts
interface RawMindfulSample {
  startDate: string;
  endDate: string;
}
```

**Qualification rule**: `Math.round((endDate − startDate) / 60000) >= 1` — sessions shorter than 1 full minute are ignored.

---

### MindfulEntry (log entry)

One log entry in the tracker representing a single mindful session.

| Field | Type | Value |
|-------|------|-------|
| `id` | `string` | `startDate` ISO string (stable dedup key) |
| `metricId` | `string` | `5dab6c51-bd6c-4a14-9047-cb588889dd7b` (pre-existing) |
| `value` | `number` | `Math.round((endDate − startDate) / 60000)` — duration in whole minutes |
| `loggedAt` | `Date` | `new Date(endDate)` — session end time |
| `sessionStartAt` | `string` | `startDate` — session start in ISO format |

---

### SyncCheckpoint

A locally-persisted timestamp marking the end time of the last processed session. Prevents reprocessing old sessions on every foreground event.

| Field | Value |
|-------|-------|
| MMKV key | `'mindful:last_sync_at'` |
| MMKV namespace | `createKV('health-sync')` (shared with running and sleep) |
| Default (first sync) | `new Date(Date.now() - NINETY_DAYS_MS)` — 90 days ago |
| Advancement | Updated to `endDate` of the last qualifying session after each sync |

---

## Data Flow

```
Apple Health
    │
    ▼ getMindfulSession({ startDate: checkpoint, endDate: now })
RawMindfulSample[]   (startDate + endDate only, sorted DESC by endDate)
    │
    ▼ sort ascending by startDate (JS-side)
RawMindfulSample[]   (ascending)
    │
    ▼ filter: durationMinutes >= 1
qualifying sessions
    │
    ▼ for each: insertLogEntry({ id: startDate, value: durationMinutes, loggedAt: endDate })
MindfulEntry (Supabase log_entries, ignoreDuplicates: true)
    │
    ▼ after loop: advance MINDFUL_LAST_SYNC_KEY to endDate of last qualifying session
SyncCheckpoint (MMKV)
```

---

## Deduplication

Each `MindfulEntry.id` is the session's `startDate` ISO string. Because mindful sessions cannot overlap, `startDate` is unique across all sessions. Supabase upsert with `onConflict: 'id', ignoreDuplicates: true` ensures that re-syncing the same session never produces a duplicate entry.

---

## Manual Resync Flow

```
Settings → "Sync Apple Health Metrics"
    │
    ▼ resyncAppleHealthMetrics()
    │   for each metric where source = 'apple_health':
    │       deleteLogEntriesForPeriod(metricId, periodStart, periodEnd)
    │       syncEntriesForMetric(metricId, periodStart)
    │           if metricId === MINDFUL_METRIC_ID:
    │               getMindfulSession(since: periodStart)
    │               sort ascending, filter durationMinutes >= 1
    │               return SyncEntry[] with id=startDate, value=durationMinutes
    │       insertLogEntry for each SyncEntry
    │       reset MINDFUL_LAST_SYNC_KEY = periodStart.toISOString()
```

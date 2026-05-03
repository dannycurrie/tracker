# Query Patterns: Habit Metric Tracker

**Branch**: `001-habit-metric-tracker` | **Date**: 2026-04-26

These are the canonical data access patterns the app uses. All queries run through the Supabase JS v2 client.

---

## 1. Fetch All Metrics (Dashboard Load)

Returns all metrics for the current user, ordered by `display_order`.

```typescript
const { data } = await supabase
  .from('metrics')
  .select('id, name, type, timeframe, display_order, created_at')
  .order('display_order', { ascending: true });
```

---

## 2. Compute Current-Period Value — Cumulative or Timed

Sum of `value` for all log entries within the active period window.

```typescript
const { data } = await supabase
  .from('log_entries')
  .select('value')
  .eq('metric_id', metricId)
  .gte('logged_at', periodStart.toISOString())
  .lt('logged_at', periodEnd.toISOString());

const total = data?.reduce((sum, row) => sum + Number(row.value), 0) ?? 0;
```

---

## 3. Compute Current-Period Value — Average

Mean of `value` for all log entries within the active period window.

```typescript
const { data } = await supabase
  .from('log_entries')
  .select('value')
  .eq('metric_id', metricId)
  .gte('logged_at', periodStart.toISOString())
  .lt('logged_at', periodEnd.toISOString());

const mean = data && data.length > 0
  ? data.reduce((sum, row) => sum + Number(row.value), 0) / data.length
  : null; // null → display "—"
```

---

## 4. Insert a Log Entry (Online)

Inserts a new log entry. Client provides the `id` UUID for idempotency.

```typescript
const { error } = await supabase
  .from('log_entries')
  .insert({
    id: clientGeneratedUUID,
    metric_id: metricId,
    value: entryValue,
    logged_at: new Date().toISOString(),
    session_start_at: sessionStartAt ?? null,
  });
```

---

## 5. Sync Offline Queue Entry (Idempotent)

Used when draining the offline queue. Safe to retry — duplicate `id` is silently ignored.

```typescript
const { error } = await supabase
  .from('log_entries')
  .upsert(
    {
      id: entry.id,
      metric_id: entry.metric_id,
      value: entry.value,
      logged_at: entry.logged_at,
      session_start_at: entry.session_start_at ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
```

---

## 6. Create a New Metric

```typescript
const { data, error } = await supabase
  .from('metrics')
  .insert({
    name: metricName,
    type: metricType,      // 'cumulative' | 'timed' | 'average'
    timeframe: timeframe,  // 'weekly' | 'monthly'
    display_order: nextOrder,
  })
  .select()
  .single();
```

---

## Period Window Helper (Client-Side)

```typescript
// utils/periods.ts
export function getPeriodWindow(
  timeframe: 'weekly' | 'monthly',
  now: Date = new Date()
): { start: Date; end: Date } {
  if (timeframe === 'weekly') {
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const daysToMonday = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  } else {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }
}
```

# Research: Metric Log View

**Branch**: `005-metric-log-view` | **Date**: 2026-05-07 | **Plan**: [plan.md](plan.md)

## Decision Log

### 1. Swipe-to-Delete vs Visible Delete Button

**Decision**: Use a visible delete button (trash icon) on each row. No swipe-to-delete.

**Rationale**: `react-native-gesture-handler` is not installed and is not a dependency of any package in the current project. Implementing swipe-to-delete via `PanResponder` manually would add significant complexity. A visible delete button achieves the same outcome (entry removal) with zero new dependencies.

**Alternatives considered**:
- Install `react-native-gesture-handler` — adds a native dependency requiring a full Xcode rebuild; disproportionate for a delete button.
- `PanResponder` manual implementation — complex, fragile, and out of scope.
- Long-press to confirm — slightly less discoverable than a visible button.

---

### 2. Full Log Entry Query (new vs extend existing)

**Decision**: Add a new `fetchPeriodLogEntries(metricId, periodStart, periodEnd): Promise<LogEntry[]>` function alongside the existing `fetchPeriodEntries` which returns `{ value: number }[]`.

**Rationale**: The existing `fetchPeriodEntries` is used by `usePeriodValue` on the dashboard and must not change shape (it would break the aggregation logic). The log view needs `id`, `logged_at`, and `session_start_at` in addition to `value`. A separate function with its own query key keeps the two concerns independent.

**Alternatives considered**: Modify `fetchPeriodEntries` to return full `LogEntry[]` — would break `usePeriodValue` which maps `.map(r => r.value)`.

---

### 3. Query Cache Invalidation

**Decision**: Update `invalidatePeriodEntries(metricId)` in `logEntries.ts` to also invalidate queries prefixed with `['periodLogEntries', metricId]`. This keeps the log view in sync after any insert or delete.

**Rationale**: TanStack Query v5 prefix matching means `queryClient.invalidateQueries({ queryKey: ['periodLogEntries', metricId] })` will invalidate any query whose key starts with those two elements — including `['periodLogEntries', metricId, start, end]`. One call covers all period windows.

---

### 4. Navigation Architecture

**Decision**: Add `MetricLog: { metricId: string }` to `RootStackParamList`. In `DashboardScreen`, wrap the `renderItem` callback's `MetricCard` with a `TouchableOpacity` that navigates to `MetricLog`. `MetricCard` itself receives no navigation prop and remains presentation-only.

**Rationale**: Keeps `MetricCard` agnostic of navigation. The wrapping `TouchableOpacity` handles the tap; the existing card content (increment button, timer, average input) continues to handle its own sub-taps via event propagation within the card. On iOS, inner `TouchableOpacity` elements within an outer one correctly intercept their own events, so the card's action buttons still work.

**Alternatives considered**: 
- Pass `onPress` to `MetricCard` — requires a prop change and makes the card less reusable.
- Use `useNavigation()` hook inside `MetricCard` — couples the component to the navigation context.

---

### 5. Log Entry Deletion

**Decision**: New `deleteLogEntry(id: string, metricId: string): Promise<void>` in `logEntries.ts`. Calls Supabase `.delete().eq('id', id)`. In local mode, delegates to a new `localDb.deleteLogEntry(id)` method. Invalidates both `['periodEntries', metricId]` and `['periodLogEntries', metricId]` after deletion.

**Rationale**: Mirrors `insertLogEntry` in style. `metricId` is needed only for cache invalidation.

---

### 6. Value Display Format

**Decision**: In the log view, display each entry's value using the same logic as `MetricCard.displayValue`: `timed` → `${value} min`; `average` → `value.toFixed(1)`; `cumulative` → `value.toFixed(0)`. Inline this logic in the `MetricLogScreen` — no extraction to a utility function (YAGNI; two locations, both simple).

**Rationale**: The formatting logic is three lines; extracting it adds an abstraction with no current re-use benefit beyond two locations.

---

### 7. Session Start Time Display (Apple Health entries)

**Decision**: If `session_start_at` is present, show it as a secondary line of text beneath the main logged time. Label: "Session started [time]". No special icon — the secondary text colour (grey) is sufficient visual distinction.

**Rationale**: Keeps the row implementation simple (two `Text` elements, no image assets). Consistent with the existing secondary-text pattern used throughout the app.

---

## Summary Table

| Unknown | Decision |
|---------|----------|
| Swipe-to-delete | Visible trash button — no new dependency |
| Full entry query | Add `fetchPeriodLogEntries` alongside existing `fetchPeriodEntries` |
| Cache invalidation | Update `invalidatePeriodEntries` to also cover `periodLogEntries` key |
| Navigation | Wrap MetricCard with TouchableOpacity at DashboardScreen level |
| Delete function | `deleteLogEntry(id, metricId)` in `logEntries.ts` + `localDb` |
| Value formatting | Inline in MetricLogScreen (same logic as MetricCard) |
| Session time display | Secondary text line if `session_start_at` present |

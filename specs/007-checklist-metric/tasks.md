# Tasks: Checklist Metric

**Input**: Design documents from `specs/007-checklist-metric/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. US1 (dashboard display + checklist screen) is independently testable with seed data. US2 (toggle interaction) layers on US1. US3 (create via Add Metric) is fully independent. New files: `src/utils/checklist.ts`, `src/hooks/useChecklistState.ts`, `src/services/checklistItems.ts`, `src/screens/ChecklistScreen/ChecklistScreen.tsx`. Modified files: `src/types/index.ts`, `src/hooks/usePreviousPeriodValue.ts`, `src/services/localDb.ts`, `src/services/metrics.ts`, `src/components/MetricCard/MetricCard.tsx`, `src/screens/index.tsx`, `src/screens/DashboardScreen/DashboardScreen.tsx`, `src/screens/AddMetricScreen/AddMetricScreen.tsx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or fully independent within same file)
- **[Story]**: Maps to user story from spec.md (US1, US2, US3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type system and navigation route changes that ALL user stories depend on.

**⚠️ CRITICAL**: Phases 3–5 cannot begin until T001 is complete. T002 and T003 can be parallelised after T001.

- [x] T001 Update `src/types/index.ts` — change `MetricType` union to `'cumulative' | 'timed' | 'average' | 'checklist'`; add `checklist_items: string[] | null` field to the `Metric` interface after the `created_at` field; no other changes; all existing code that destructures or checks `MetricType` will need to handle the new branch (TypeScript will flag unhandled cases)
- [x] T002 [P] Create `src/utils/checklist.ts` — export a single function `stableChecklistItemId(metricId: string, itemIndex: number, periodStart: Date): string` that returns the string `` `${metricId}-chk-${itemIndex}-${periodStart.getTime()}` ``; no imports needed; this is the deterministic log entry ID for a specific checklist item in a specific period
- [x] T003 [P] Update `src/screens/index.tsx` — add `Checklist: { metricId: string }` to `RootStackParamList`; add `import { ChecklistScreen } from './ChecklistScreen/ChecklistScreen'` at top; add `<Stack.Screen name="Checklist" component={ChecklistScreen} />` inside `Stack.Navigator` after the MetricLog screen

**Checkpoint**: Types updated, route registered, stable-ID utility ready — all story-level work can begin.

---

## Phase 3: User Story 1 — View Checklist Progress on Dashboard (Priority: P1) 🎯 MVP

**Goal**: Dashboard shows "X/N" on checklist metric cards; tapping opens a read-only checklist screen listing all items with their current check state. Seed data provides a pre-checked metric so this is testable without implementing US2 or US3.

**Independent Test**: Open Dashboard in local mode → confirm "Morning Routine" card shows "2/4" → tap card → confirm ChecklistScreen opens with 4 items, "Workout" and "Vitamins" shown as checked (✓), "Cold shower" and "Meditation" unchecked (○) → tap back → return to dashboard.

- [x] T004 [P] [US1] Create `src/hooks/useChecklistState.ts` — export `useChecklistState(metric: Metric): { checkedCount: number; totalCount: number; isItemChecked: (idx: number) => boolean; isLoading: boolean }` — implementation: call `const { start } = getPeriodWindow(metric.timeframe)`; call `const { entries, isLoading } = usePeriodLogEntries(metric)`; `const items = metric.checklist_items ?? []`; `const totalCount = items.length`; `const isItemChecked = (idx: number): boolean => entries.some(e => e.id === stableChecklistItemId(metric.id, idx, start))`; `const checkedCount = items.filter((_, i) => isItemChecked(i)).length`; return `{ checkedCount, totalCount, isItemChecked, isLoading }`; imports: `Metric` from `'../types'`; `usePeriodLogEntries` from `'./usePeriodLogEntries'`; `getPeriodWindow` from `'../utils/periods'`; `stableChecklistItemId` from `'../utils/checklist'`
- [x] T005 [P] [US1] Update `src/hooks/usePreviousPeriodValue.ts` — add `if (metric.type === 'checklist') return { value: null };` as the very first line inside the `usePreviousPeriodValue` function body, before the `getPreviousPeriodWindow` call; this suppresses the previous period comparison label for checklist metrics (sum of 1/N values would show a meaningless proportion like "0.75")
- [x] T006 [P] [US1] Update `src/services/localDb.ts` — (a) add `checklist_items: null` field to each of the 3 existing seed metrics in `buildSeedMetrics()` (mock-1, mock-2, mock-3) so they satisfy the updated `Metric` interface; (b) add a fourth seed metric: `{ id: 'mock-4', name: 'Morning Routine', type: 'checklist', timeframe: 'weekly', source: 'user', display_order: 3, created_at: hoursAgo(72), checklist_items: ['Workout', 'Vitamins', 'Cold shower', 'Meditation'] }`; (c) add 2 seed log entries to `buildSeedEntries()` for mock-4 — compute `const periodStart = getPeriodWindow('weekly').start` at the top of `buildSeedEntries`, then add: `{ id: stableChecklistItemId('mock-4', 0, periodStart), metric_id: 'mock-4', value: 0.25, logged_at: hoursAgo(2), session_start_at: null, created_at: now }` and `{ id: stableChecklistItemId('mock-4', 1, periodStart), metric_id: 'mock-4', value: 0.25, logged_at: hoursAgo(1), session_start_at: null, created_at: now }`; (d) update `createMetric` function signature to accept optional `checklistItems?: string[]` parameter and store it as `checklist_items: checklistItems ?? null` on the created metric object; imports needed: `stableChecklistItemId` from `'../utils/checklist'` and `getPeriodWindow` from `'../utils/periods'`
- [x] T007 [US1] Update `src/components/MetricCard/MetricCard.tsx` — (a) add `import { useChecklistState } from '../../hooks/useChecklistState'`; (b) inside `MetricCard`, add `const checklistState = useChecklistState(metric)` immediately after the existing `usePreviousPeriodValue` call (hooks cannot be conditional — always call it); (c) update the `displayValue` IIFE: add a first branch `if (metric.type === 'checklist') { return checklistState.isLoading ? '…' : \`${checklistState.checkedCount}/${checklistState.totalCount}\`; }` before the existing `if (isLoading)` check; (d) the existing action button section (`metric.type === 'cumulative'`, `metric.type === 'timed'`, `metric.type === 'average'` conditions) already handles the checklist case by exclusion — no explicit checklist branch needed for the action buttons since none of the three existing conditions match 'checklist'
- [x] T008 [US1] Create `src/screens/ChecklistScreen/ChecklistScreen.tsx` — display-only screen (US2 adds toggle interaction); component: `export function ChecklistScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Checklist'>)`; get `metricId` from `route.params.metricId`; get metric via `useMetrics().metrics.find(m => m.id === metricId)` — return `null` if not found; call `useChecklistState(metric)`; render: `SafeAreaView` with `StatusBar barStyle="dark-content"` → header row with back `TouchableOpacity` (`navigation.goBack()`) + metric name `Text` + period badge `Text` (`formatPeriodLabel(metric.timeframe)`) → body: `ActivityIndicator` when `isLoading`; otherwise `FlatList` over `metric.checklist_items ?? []` where each row is a `View` with a `Text` for the item label on the left and a `Text` showing `isItemChecked(index) ? '✓' : '○'` on the right (inside a `TouchableOpacity` that does nothing yet — `onPress={() => {}}` placeholder); `keyExtractor={(_, i) => String(i)}`; styles: card rows with `flexDirection: 'row'`, `justifyContent: 'space-between'`, `paddingVertical: 14`, `paddingHorizontal: 16`; checked indicator style: `fontSize: 22, color: '#34C759'` (green checkmark); unchecked indicator style: `fontSize: 22, color: '#ccc'`; imports: `React`, `View`, `Text`, `FlatList`, `TouchableOpacity`, `ActivityIndicator`, `StyleSheet`, `SafeAreaView`, `StatusBar` from `'react-native'`; `NativeStackScreenProps` from `'@react-navigation/native-stack'`; `RootStackParamList` from `'../index'`; `useMetrics` from `'../../hooks/useMetrics'`; `useChecklistState` from `'../../hooks/useChecklistState'`; `formatPeriodLabel` from `'../../utils/periods'`
- [x] T009 [US1] Update `src/screens/DashboardScreen/DashboardScreen.tsx` — update `renderItem` `onPress` to: `onPress={() => item.type === 'checklist' ? navigation.navigate('Checklist', { metricId: item.id }) : navigation.navigate('MetricLog', { metricId: item.id })`; no other changes

**Checkpoint**: User Story 1 complete — Dashboard shows "2/4" for seed Morning Routine metric; tapping opens read-only checklist screen; non-checklist cards navigate to MetricLogScreen as before.

---

## Phase 4: User Story 2 — Check and Uncheck Items (Priority: P2)

**Goal**: Tapping a checklist item in the ChecklistScreen toggles its state. The dashboard X/N count updates immediately. Checked state persists across app sessions within the same period.

**Independent Test**: Open ChecklistScreen for Morning Routine (shows "2/4") → tap "Cold shower" (unchecked) → confirm it shows ✓ and dashboard shows "3/4" → close and reopen app → confirm "Cold shower" still checked → tap it again → confirms it shows ○ and dashboard shows "2/4".

- [x] T010 [US2] Create `src/services/checklistItems.ts` — export two async functions: (1) `checkItem(metric: Metric, itemIndex: number): Promise<void>` — gets `const { start } = getPeriodWindow(metric.timeframe)`; `const totalItems = metric.checklist_items?.length ?? 1`; calls `await insertLogEntry({ id: stableChecklistItemId(metric.id, itemIndex, start), metricId: metric.id, value: 1 / totalItems })`; (2) `uncheckItem(metric: Metric, itemIndex: number): Promise<void>` — gets `const { start } = getPeriodWindow(metric.timeframe)`; calls `await deleteLogEntry(stableChecklistItemId(metric.id, itemIndex, start), metric.id)`; imports: `Metric` from `'../types'`; `insertLogEntry`, `deleteLogEntry` from `'./logEntries'`; `getPeriodWindow` from `'../utils/periods'`; `stableChecklistItemId` from `'../utils/checklist'`
- [x] T011 [US2] Update `src/screens/ChecklistScreen/ChecklistScreen.tsx` — (a) add `import { checkItem, uncheckItem } from '../../services/checklistItems'`; (b) add `const [isPending, setIsPending] = useState<number | null>(null)` state to track which item index is currently toggling (prevents double-tap); (c) add `handleToggle` function: `async function handleToggle(index: number): Promise<void> { if (isPending !== null) return; setIsPending(index); try { if (isItemChecked(index)) { await uncheckItem(metric, index); } else { await checkItem(metric, index); } } finally { setIsPending(null); } }`; (d) replace the placeholder `onPress={() => {}}` on the indicator `TouchableOpacity` with `onPress={() => handleToggle(index)}`; (e) add `disabled={isPending !== null}` to the indicator `TouchableOpacity`; (f) import `useState` from `'react'` if not already imported

**Checkpoint**: User Story 2 complete — items toggle on tap; dashboard X/N updates immediately; state persists across restarts.

---

## Phase 5: User Story 3 — Create a Checklist Metric (Priority: P3)

**Goal**: Add Metric screen supports a "Checklist" type option with an item-entry section (1–10 named items). Saving creates the metric and shows "0/N" on the dashboard.

**Independent Test**: Tap "+ Add" → enter name "Evening Wind-Down" → select Checklist → add 3 items: "Read", "Meditate", "Journaling" → tap Save → confirm card appears on dashboard showing "0/3" → tap card → confirm ChecklistScreen shows 3 items all unchecked.

- [x] T012 [P] [US3] Update `src/services/metrics.ts` — (a) update `fetchUserMetrics` Supabase `.select(...)` string to include `checklist_items`: change to `'id, name, type, timeframe, source, display_order, created_at, checklist_items'`; (b) add optional `checklistItems?: string[]` parameter to `createMetric(name, type, timeframe, source, checklistItems?)` — add it after `source`; (c) include `checklist_items: checklistItems ?? null` in the Supabase `.insert({...})` payload; (d) pass `checklistItems` through to `localDb.createMetric(name, type, timeframe, source, checklistItems)`
- [x] T013 [US3] Update `src/screens/AddMetricScreen/AddMetricScreen.tsx` — (a) add `{ label: 'Checklist', value: 'checklist' }` as 4th entry in `TYPE_OPTIONS`; (b) add state `const [checklistItems, setChecklistItems] = useState<string[]>([''])` (starts with one empty item); (c) add state `const [itemsError, setItemsError] = useState('')`; (d) in `handleSubmit`, after the name check, add checklist validation: `if (type === 'checklist') { if (checklistItems.every(s => !s.trim())) { setItemsError('At least one item is required'); return; } if (checklistItems.some(s => !s.trim())) { setItemsError('All item names must be non-empty'); return; } }`; (e) update the `createMetric` call to pass `checklistItems.filter(s => s.trim()).map(s => s.trim())` as the 5th argument when `type === 'checklist'` (pass `undefined` otherwise); (f) after the type segment row, add conditional item-entry section `{type === 'checklist' && (<View>...</View>)}` containing: label `ITEMS`, a `FlatList`-style (or `map`-rendered) list of `TextInput` elements each with a "−" `TouchableOpacity` remove button (disabled when `checklistItems.length === 1`); a "+ Add item" `TouchableOpacity` at bottom disabled when `checklistItems.length >= 10`; item add handler: `setChecklistItems(prev => [...prev, ''])`; item remove handler: `setChecklistItems(prev => prev.filter((_, i) => i !== idx))`; item change handler: `setChecklistItems(prev => prev.map((v, i) => i === idx ? text : v))`; show `itemsError` in red when non-empty; (g) update `typeHintText` to add: `{type === 'checklist' && 'Define items to check off each period — tracked as X/N progress.'}`; (h) update the Save button disabled condition: also disable when `type === 'checklist' && checklistItems.every(s => !s.trim())`

**Checkpoint**: User Story 3 complete — checklist metrics can be created via Add Metric and appear on dashboard with "0/N".

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T014 [P] Verify TypeScript compiles cleanly — run `npx tsc --noEmit` and confirm zero new errors introduced by this feature (pre-existing `useTimer.ts` `getStartedAt` warning is acceptable)
- [ ] T015 [P] Verify non-checklist metric cards show no regression — in local mode confirm: "Cups of coffee" shows count + "+ Add" button that increments; "Reading" shows minutes + Start/Stop timer; "Sleep quality" shows average + input; all three still navigate to MetricLogScreen on card tap; previous period comparison labels appear correctly
- [ ] T016 [P] Verify checklist feature end-to-end — open Dashboard → "Morning Routine" shows "2/4" (seed data) → tap → ChecklistScreen shows Workout ✓, Vitamins ✓, Cold shower ○, Meditation ○ → tap Cold shower → shows ✓ → back → dashboard shows "3/4" → reinstall or clear seed data to test US3 flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: T001 must precede all others; T002 and T003 can be parallel after T001
- **US1 (Phase 3)**: Depends on Foundational complete; T004, T005, T006 are parallel (different files); T007 depends on T004; T008 depends on T003+T004; T009 depends on T003+T008
- **US2 (Phase 4)**: T010 depends on T001+T002; T011 depends on T008+T010
- **US3 (Phase 5)**: T012 depends on T001; T013 depends on T001+T012
- **Polish (Final)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Core dependency — US2 and US3 build on top; MVP stops here
- **US2 (P2)**: Depends on T008 (ChecklistScreen exists)
- **US3 (P3)**: Depends on T001 (types), T006 (localDb createMetric update); independent of US2

### Within Phase 3 (US1)

```
T001 + T002 → T004 [P]
T001 → T005 [P]
T001 + T002 → T006 [P]
              T004 → T007
T003 + T004 → T008
T003 + T008 → T009
```

### Parallel Opportunities

```bash
# After T001 — run in parallel:
Task T002: "stableChecklistItemId utility in src/utils/checklist.ts"
Task T003: "Checklist route in src/screens/index.tsx"

# After T001 + T002 + T003 — run in parallel:
Task T004: "useChecklistState hook in src/hooks/useChecklistState.ts"
Task T005: "usePreviousPeriodValue early return in src/hooks/usePreviousPeriodValue.ts"
Task T006: "localDb seed data in src/services/localDb.ts"

# Phase 5 — run in parallel:
Task T012: "metrics.ts update in src/services/metrics.ts"
(T013 sequential after T012)

# Final Phase — run in parallel:
Task T014: "TypeScript compile check"
Task T015: "Non-checklist regression check"
Task T016: "Checklist feature end-to-end verification"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: T001 → T002 [P] + T003 [P]
2. Complete Phase 3: T004 [P] + T005 [P] + T006 [P] → T007 → T008 → T009
3. **STOP and VALIDATE**: Open Dashboard in local mode — confirm "Morning Routine" shows "2/4" → tap → see checklist items
4. Verify non-checklist cards still work (quick manual check)

### Incremental Delivery

1. Foundational + US1 → MVP: read-only checklist display
2. US2 → Toggle interaction: check/uncheck items
3. US3 → Create checklist metrics via Add Metric
4. Polish → Type check, regression, end-to-end verification

---

## Notes

- T001 will cause TypeScript errors in files that exhaustively switch on `MetricType` — they'll need a `'checklist'` case added. Most existing type checks use individual `metric.type === 'x'` guards rather than switch statements, so impact should be minimal
- T006 seed data: existing seed metrics (mock-1, mock-2, mock-3) need `checklist_items: null` added to satisfy the updated interface — without this, TypeScript will flag missing property errors
- T006 imports `getPeriodWindow` and `stableChecklistItemId` — these are used at seed-build time (computed once per `buildSeedEntries()` call). Since seed data is seeded once (SEEDED_KEY), existing devices must reinstall or clear storage to pick up updated seed entries
- T008 uses `onPress={() => {}}` placeholder on toggle indicator — this is intentional. US2 (T011) replaces it with real interaction
- T010 (checklistItems.ts): `insertLogEntry` already uses upsert-on-conflict for the ID — calling `checkItem` twice for the same item in the same period is idempotent
- T011 `isPending` tracks a single item index (`number | null`) rather than a boolean — this prevents double-tapping while still allowing other items to be tapped
- T013: the Add Metric screen currently renders items via state-driven `map` rather than a `FlatList` to avoid the vertical nesting complexity inside a `ScrollView`; use `checklistItems.map((item, index) => <View key={index}>...</View>)` within the existing `ScrollView`
- Supabase migration required before T012 works in non-local mode: `ALTER TABLE metrics ADD COLUMN checklist_items JSONB;`

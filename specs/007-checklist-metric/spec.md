# Feature Specification: Checklist Metric

**Feature Branch**: `007-checklist-metric`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "We're adding a new type of metric: the checklist metric. Checklist metrics can have up to 10 items which can be checked off by the user during the metric's time period (week / month). Once checked, an item remains checked for that period unless it is unchecked. When checking an item, we log a proportional value for the checklist metric e.g. if we have 4 items, we log a value of 0.25. The metric card for a checklist metric should show the number of items checked within the list e.g. 2/5. Tapping the metric card opens the checklist with the items displayed"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Checklist Progress on Dashboard (Priority: P1)

A checklist metric card on the dashboard displays the number of items checked out of the total in "X/N" format (e.g., "2/5"). Tapping the card opens a dedicated checklist screen where all items are listed with their current check state for the period. This gives the user an instant view of their completion progress and a clear path to interact with individual items.

**Why this priority**: Without the dashboard display and access to the checklist screen, the feature has no usable surface. This story is the MVP — it delivers the full viewing experience and is a prerequisite for meaningful interaction.

**Independent Test**: With seed data providing a checklist metric with 5 items and 2 checked in the current period → dashboard shows "2/5" on the checklist card → tapping opens a checklist screen listing all 5 items with 2 shown as checked.

**Acceptance Scenarios**:

1. **Given** a checklist metric with 5 items and 2 checked this period, **When** the dashboard loads, **Then** the metric card shows "2/5" as the primary value
2. **Given** a checklist metric with no items checked this period, **When** the dashboard loads, **Then** the metric card shows "0/N" where N is the total item count
3. **Given** a checklist metric with all items checked, **When** the dashboard loads, **Then** the metric card shows "N/N"
4. **Given** a checklist metric card on the dashboard, **When** the user taps the card, **Then** a checklist screen opens showing all items with their checked or unchecked state for the current period
5. **Given** the checklist screen is open, **When** the user taps back, **Then** they return to the dashboard

---

### User Story 2 — Check and Uncheck Items (Priority: P2)

From the checklist screen, the user can tap any item to toggle its state. Tapping an unchecked item checks it; tapping a checked item unchecks it. Both actions update the dashboard card's X/N count immediately. The check state persists across app sessions within the same period — reopening the app shows the same items checked.

**Why this priority**: Interacting with the checklist is the core value of the feature. Without it, users can only view a static list.

**Independent Test**: Open a checklist screen → tap an unchecked item → confirm it becomes checked and the dashboard X count increments → close and reopen the app → confirm the item is still checked → tap the item to uncheck → confirm the count decrements.

**Acceptance Scenarios**:

1. **Given** an unchecked item in the checklist screen, **When** the user taps it, **Then** the item shows as checked and the dashboard card X count increments by 1
2. **Given** a checked item in the checklist screen, **When** the user taps it, **Then** the item shows as unchecked and the dashboard card X count decrements by 1
3. **Given** one or more checked items in the current period, **When** the user closes and reopens the app within the same period, **Then** the previously checked items are still shown as checked
4. **Given** the period ends (e.g., new week or new month begins), **When** the user opens the dashboard, **Then** all items show as unchecked (0/N) — no check state carries over from the previous period
5. **Given** a checklist with N items, **When** the user checks all N items, **Then** the card shows "N/N" and the checklist screen shows all items as checked

---

### User Story 3 — Create a Checklist Metric (Priority: P3)

When adding a new metric, the user can select "Checklist" as the metric type. After selecting this type, an item-definition section appears where the user enters between 1 and 10 named items. Saving creates the metric, which then appears on the dashboard with "0/N" progress.

**Why this priority**: Creating custom checklist metrics personalises the feature. However, US1 and US2 can be fully tested using seed data, making metric creation a P3 increment that does not block the MVP.

**Independent Test**: Navigate to Add Metric → select Checklist → enter 3 item names → save → confirm the new metric appears on the dashboard as "0/3".

**Acceptance Scenarios**:

1. **Given** the Add Metric screen, **When** the user selects Checklist as the metric type, **Then** an item-entry section appears allowing up to 10 named items to be defined
2. **Given** the user has entered at least 1 non-empty item name, **When** they save the metric, **Then** the checklist metric is created and appears on the dashboard showing "0/N"
3. **Given** the user attempts to save with no items defined, **When** they tap save, **Then** the save is blocked and a message indicates that at least 1 item is required
4. **Given** the user attempts to save with a blank item name, **When** they tap save, **Then** the save is blocked and the blank item is highlighted as invalid
5. **Given** the user has already defined 10 items, **When** they attempt to add an 11th, **Then** the add-item control is disabled — no further items can be entered
6. **Given** a checklist metric is saved with N items, **When** the dashboard loads, **Then** the card displays "0/N" for the current period

---

### Edge Cases

- What if a checklist metric has exactly 1 item? → Valid; card shows "0/1" or "1/1"; the logged proportional value when checked is 1.0
- What if the app is opened at a period boundary (e.g., the first day of a new month)? → The new period contains no checked items; all items display as unchecked
- What if an item name is blank during metric creation? → Blank item names are rejected; saving is blocked until all listed items have non-empty names
- What if two items in the same checklist share the same name? → Duplicate item names are allowed; the user may name items however they like
- Can checklist items be renamed or removed after metric creation? → Not supported in this feature; items are fixed once the metric is created
- What if the user navigates to the checklist screen for a metric with 0 items checked (new period)? → The screen shows all items unchecked; no special empty state is needed

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a new "checklist" metric type alongside the existing cumulative, timed, and average types
- **FR-002**: Each checklist metric MUST have between 1 and 10 named items; items are defined at creation time and are fixed thereafter
- **FR-003**: The checklist metric card MUST display progress as "X/N" where X is the count of checked items in the current period and N is the total item count
- **FR-004**: Tapping a checklist metric card MUST open a checklist screen listing all items with their current checked or unchecked state for the period
- **FR-005**: Checking an unchecked item MUST record a proportional value of 1/N for the metric in the current period (where N is the total item count)
- **FR-006**: Unchecking a checked item MUST remove the record associated with that item for the current period, reverting the X/N count
- **FR-007**: A checked item's state MUST persist across app sessions within the same period
- **FR-008**: At the start of a new period, all items MUST be unchecked — no checked state carries over between periods
- **FR-009**: When creating a metric with type Checklist, the user MUST be able to define between 1 and 10 named items before saving
- **FR-010**: The Add Metric screen MUST block saving a checklist metric when no items are defined or when any item name is blank

### Key Entities

- **ChecklistItem**: A named item belonging to a checklist metric. Has a stable identity, an ordered position within the checklist, and a non-empty display label. Belongs to exactly one checklist metric. Between 1 and 10 items per metric. Fixed once the metric is created.
- **CheckedState** (derived): The per-item completion state for the current period — checked or unchecked. Not persisted separately; computed from period records. Resets to unchecked at the start of each new period.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The checklist card X/N count updates within 1 second of the user checking or unchecking an item
- **SC-002**: A checked item's state is correctly restored when the app is reopened within the same period — 0 items lose their checked state across sessions
- **SC-003**: 100% of checklist items revert to unchecked at the start of each new period — 0 stale checked states carry over
- **SC-004**: The Add Metric flow accepts 1–10 non-empty item names and rejects all attempts to save with 0 or blank items — 0 invalid checklist metrics created
- **SC-005**: All existing metric types (cumulative, timed, average) continue to function correctly — 0 regressions on existing metric cards after this feature is added

## Assumptions

- Checklist items are defined once at metric creation and cannot be renamed, reordered, or removed after the metric is saved; this avoids data-migration complexity and is consistent with the app's current approach to metric configuration
- Unchecking an item removes the record for that item in the current period; the X/N count decreases accordingly
- Each period record is associated with a specific checklist item so that the checked state of individual items can be derived accurately; the exact mechanism is a planning-phase concern
- The checklist screen is distinct from the existing log-entry view (MetricLogScreen); it shows items by name with a toggle control rather than a chronological list of raw entries
- The metric card for a checklist metric shows "X/N" as the primary display value; it does not show a cumulative "+ Add" button, timer control, or average input
- The timeframe for a checklist metric follows the same weekly/monthly pattern as all other metric types; the Monday–Sunday week and calendar-month boundaries apply
- The previous period comparison (feature 006) will apply to checklist metrics using the sum of recorded values from the prior period; this produces a proportion (e.g., "0.8 last week" for 4/5 items) rather than an X/N count — refining this display for checklist metrics is out of scope for this feature

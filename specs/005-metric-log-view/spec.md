# Feature Specification: Metric Log View

**Feature Branch**: `005-metric-log-view`
**Created**: 2026-05-07
**Status**: Draft
**Input**: User description: "On tapping a metric, show the logs for that metric within the current timeframe"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Log History for a Metric (Priority: P1)

Tapping a metric card on the dashboard navigates to a log view screen that shows every individual log entry recorded for that metric within its current timeframe (the current week for weekly metrics, the current month for monthly metrics). Entries are listed most-recent first, each showing its value and when it was logged.

**Why this priority**: This is the entire feature. Without the ability to see individual entries, the user has no visibility into what makes up the summary value shown on the dashboard card.

**Independent Test**: Tap any metric that has entries → confirm a new screen opens showing a list of entries with values and timestamps matching the current period.

**Acceptance Scenarios**:

1. **Given** a metric with three log entries in the current period, **When** the user taps the metric card, **Then** a log view screen opens listing all three entries in reverse chronological order (most recent at the top)
2. **Given** a metric with no entries in the current period, **When** the user taps the metric card, **Then** the log view screen opens and shows a message indicating no entries have been recorded yet
3. **Given** a metric with entries from a previous period, **When** the user taps the metric card, **Then** only entries within the current period are shown — past-period entries are not included
4. **Given** the log view is open, **When** the user taps the back button, **Then** the user returns to the dashboard

---

### User Story 2 — Delete a Log Entry (Priority: P2)

From the log view, the user can delete an individual log entry. This corrects accidental duplicates or mistaken entries without having to navigate elsewhere.

**Why this priority**: Seeing the logs without being able to correct them has limited utility. Deletion is the most common correction action once a user can see their history.

**Independent Test**: Add two entries to a metric → open the log view → delete one entry → confirm only one entry remains in the list and the dashboard summary value updates accordingly.

**Acceptance Scenarios**:

1. **Given** a log entry is visible in the list, **When** the user swipes the entry left and taps "Delete", **Then** the entry is removed from the list and the dashboard summary reflects the updated total
2. **Given** an Apple Health-sourced entry (auto-synced, not manually added), **When** the user deletes it from the log view, **Then** the entry is removed from the current period's log; it may reappear on next sync if still present in Apple Health
3. **Given** the user deletes the last entry in the period, **When** the deletion completes, **Then** the list shows the empty state message

---

### User Story 3 — Entry Source Context (Priority: P3)

Each log entry in the list visually indicates when it originated from an Apple Health session (as opposed to a manual tap or timer). Apple Health entries show the original session start time alongside the log time, giving the user context about which workout, sleep, or mindfulness session produced the entry.

**Why this priority**: Useful context but not essential for v1. Users can understand their data without it; it mainly helps distinguish auto-synced entries from manual ones.

**Independent Test**: Sync a running workout → open the Running Distance log view → confirm the entry shows both the session start time and the log time, distinguishable from a manually-added entry.

**Acceptance Scenarios**:

1. **Given** a log entry originated from an Apple Health session (has a session start time), **When** it appears in the log view, **Then** it shows both the session start time and the logged time, and is visually distinguished from manually-added entries
2. **Given** a manually-added log entry (no session start time), **When** it appears in the log view, **Then** it shows only the logged time with no session context

---

### Edge Cases

- What if the metric has hundreds of log entries in the period? → The list scrolls; all entries for the current period are displayed without pagination
- What if an entry's value is a decimal? → Display it with the same formatting used on the dashboard card (e.g. "3.2 km", "7.4")
- What if the screen is opened while entries are still loading? → Show a loading indicator until entries are available
- What if the deletion fails (e.g. offline)? → Show an error message; the entry remains in the list
- What if two entries have identical logged times? → Both are shown; each is independently deletable

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tapping a metric card on the dashboard MUST navigate to the log view screen for that metric
- **FR-002**: The log view MUST display all log entries for the metric within its current period (current week for weekly metrics, current month for monthly metrics)
- **FR-003**: Entries MUST be sorted most-recent-first (by logged time, descending)
- **FR-004**: Each entry MUST show its value and the date and time it was logged
- **FR-005**: The log view header MUST show the metric name and current period label (e.g. "May 2026" or "Apr 28 – May 4")
- **FR-006**: The log view MUST include a back navigation control to return to the dashboard
- **FR-007**: When no entries exist for the current period, the log view MUST display a friendly empty-state message
- **FR-008**: Users MUST be able to delete individual log entries from the log view
- **FR-009**: Deleting an entry MUST immediately remove it from the list and update the dashboard summary value
- **FR-010**: Apple Health-sourced entries MUST display the original session start time in addition to the logged time
- **FR-011**: The log view MUST show a loading indicator while entries are being fetched

### Key Entities

- **LogEntry**: A single recorded data point for a metric. Key attributes: value, logged date/time, optional session start time (for Apple Health-sourced entries). Entries belong to exactly one metric.
- **MetricLogView**: The screen presenting a metric's entries for the current period. Scoped to the metric's timeframe; shows aggregated summary at top, list of individual entries below.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The log view screen opens within 1 second of tapping a metric card
- **SC-002**: All entries for the current period are visible without any additional user action (no "load more" required for typical period volumes)
- **SC-003**: Deleting an entry completes within 2 seconds and the list updates immediately — no manual refresh required
- **SC-004**: The empty state is shown when zero entries exist; it is never shown when entries are present

## Assumptions

- The log view is read-only except for deletion — adding new entries is done from the dashboard card, not from this screen
- The current period is determined by the metric's timeframe setting (`weekly` or `monthly`) using the same period window logic already in the app
- Entries from previous periods are not shown — the scope is strictly the current period
- No pagination is needed; the number of entries within a single period is small enough to display as a flat list
- Apple Health metrics (running, sleep, mindfulness) may have auto-synced entries — deletion of these entries is permitted and the user is not warned that sync may re-create them
- The metric's display name and timeframe label are already available from the existing metric data — no additional data fetching is needed for the header

# Feature Specification: Habit Metric Tracker

**Feature Branch**: `001-habit-metric-tracker`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "A mobile app that allows users to increment and track habits as metrics (e.g. minutes of reading, number of sugary snacks eaten) with timed, cumulative, and average tracking types, offline support, and cloud persistence."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View and Increment Metrics (Priority: P1)

A user opens the app and sees their dashboard showing all their metrics with current period totals. They can quickly increment any metric directly from this screen without navigating away.

**Why this priority**: This is the core daily interaction — the primary value of the app is quick, frictionless metric tracking. Without this, there is no app.

**Independent Test**: Can be fully tested with a single cumulative metric. The user sees the metric, taps to increment, and the value updates immediately — delivering the app's core value loop.

**Acceptance Scenarios**:

1. **Given** the user has at least one metric, **When** they open the app, **Then** they see all their metrics with names, types, timeframes, and current period values displayed
2. **Given** a cumulative metric is displayed, **When** the user taps the increment button, **Then** the displayed value increases by 1 and the change is persisted
3. **Given** the user increments any metric, **When** the update is persisted, **Then** a timestamped log entry is created recording that action

---

### User Story 2 - Create a New Metric (Priority: P2)

A user sets up a new habit metric by specifying its name, type (timed / cumulative / average), and timeframe (weekly / monthly).

**Why this priority**: Users must be able to add metrics before the core tracking loop has value, but a seed dataset can serve for initial P1 testing.

**Independent Test**: Can be tested in isolation by creating one metric of each type and verifying each appears correctly on the dashboard with a starting value of zero.

**Acceptance Scenarios**:

1. **Given** the user taps "Add Metric", **When** they enter a name, select a type, and select a timeframe and confirm, **Then** the metric appears on the dashboard with a current value of 0
2. **Given** the user creates a timed metric, **When** it appears on the dashboard, **Then** it shows a start/stop timer control
3. **Given** the user creates a cumulative metric, **When** it appears on the dashboard, **Then** it shows a single-tap increment control
4. **Given** the user creates an average metric, **When** it appears on the dashboard, **Then** it shows a 1–5 value input control

---

### User Story 3 - Timed Session Tracking (Priority: P3)

A user tracks time spent on a habit (e.g., reading) by starting a timer when they begin and stopping it when they finish. The elapsed time in minutes is added to their metric's current period total.

**Why this priority**: Timed tracking is a distinct and valuable mode but is not required for the core tracking loop, which functions with cumulative metrics.

**Independent Test**: Can be tested in isolation with a single timed metric. Starting and stopping the timer, then verifying the period total increases by the correct number of minutes, confirms the feature is complete.

**Acceptance Scenarios**:

1. **Given** a timed metric, **When** the user taps "Start", **Then** the timer begins counting up and remains active if the app is backgrounded
2. **Given** an active timer, **When** the user returns to the app and taps "Stop", **Then** the elapsed time (in whole minutes, rounding down) is added to the metric's current period total
3. **Given** the user stops a timed session, **When** the update is persisted, **Then** a log entry is created recording the session duration and end timestamp
4. **Given** an active timer exists for a metric, **When** the user views the dashboard, **Then** the timer is shown as running with the live elapsed time

---

### User Story 4 - Average Value Tracking (Priority: P4)

A user records a subjective quality rating (1–5) for a habit. The metric displays the running average of all entries in the current period.

**Why this priority**: Valuable for habits measured by quality (e.g., sleep quality, mood), but not essential to the core tracking flow.

**Independent Test**: Can be tested with a single average metric by submitting multiple 1–5 values and verifying the displayed figure equals their arithmetic mean.

**Acceptance Scenarios**:

1. **Given** an average metric, **When** the user taps the metric and submits a value between 1 and 5, **Then** the metric's displayed value updates to reflect the new running average for the current period
2. **Given** an average metric with multiple entries in the current period, **When** viewed on the dashboard, **Then** the displayed value is the arithmetic mean of all entries, rounded to one decimal place
3. **Given** the user submits an average entry, **When** it is persisted, **Then** a log entry is created recording the submitted value and timestamp
4. **Given** an average metric with no entries in the current period, **When** viewed on the dashboard, **Then** the displayed value is shown as "—" (no data)

---

### User Story 5 - Offline Usage (Priority: P5)

A user increments metrics while offline (e.g., on a plane), and all actions sync automatically once connectivity is restored — with no data loss.

**Why this priority**: Important for real-world reliability, but the app functions fully in online mode first.

**Independent Test**: Can be tested by enabling airplane mode, making several increments across metric types, restoring connectivity, and verifying all changes appear correctly with no duplicate or missing log entries.

**Acceptance Scenarios**:

1. **Given** the device has no internet connection, **When** the user increments any metric, **Then** the local value updates immediately and the action is queued for upload
2. **Given** queued actions exist, **When** internet connectivity is restored, **Then** all queued actions are uploaded to the server in chronological order without user intervention
3. **Given** actions are successfully synced, **When** sync completes, **Then** the server state matches the local state with no duplicate or missing log entries
4. **Given** the app is offline, **When** the user views the dashboard, **Then** an offline indicator is displayed

---

### Edge Cases

- **Period reset with offline queue**: Offline-queued actions use the client-side `logged_at` timestamp; they are attributed to the period they were recorded in, not the period in which they synced. This is correct behaviour — a Sunday tap queued offline and synced on Monday still counts in the previous weekly period.
- **Force-quit or battery death mid-timer**: If the app is force-quit or the device loses power during an active timed session, the partial session is discarded. No log entry is created. The timer resets silently on next launch.
- **Average value out of range**: The UI prevents submission of values outside 1–5; inputs outside this range are rejected with inline validation before any action is taken.
- **Multi-device conflicts**: Conflicts from simultaneous offline updates across devices are resolved by last-write-wins (server accepts all log entries since they are append-only; current-period value is always derived, never overwritten).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all of the authenticated user's metrics on the main screen in creation order, each showing its name, type, timeframe, and current period accumulated value
- **FR-002**: System MUST support three metric types: cumulative, timed, and average
- **FR-003**: System MUST support two metric timeframes: weekly (resets each Monday at 00:00 in the user's local timezone) and monthly (resets on the 1st of each month at 00:00 in the user's local timezone)
- **FR-004**: Users MUST be able to create a new metric by providing a name, selecting a type, and selecting a timeframe
- **FR-005**: System MUST allow users to increment a cumulative metric by 1 with a single tap
- **FR-006**: System MUST allow users to start and stop a timer for a timed metric; on stop, the elapsed time in whole minutes is added to the metric's current period total
- **FR-007**: System MUST keep a timed session's timer running while the app is in the background
- **FR-008**: System MUST allow users to submit an integer value from 1 to 5 for an average metric; the displayed current value updates to the running arithmetic mean of all entries in the current period
- **FR-009**: System MUST create a timestamped log entry for every increment action: each cumulative tap, each timed session stop (recording duration), and each average value submission
- **FR-010**: System MUST persist all changes to the cloud database in real time when an internet connection is available
- **FR-011**: System MUST queue increment actions locally when offline and upload them to the cloud in chronological order when connectivity is restored, without requiring user action
- **FR-012**: System MUST display an indicator when the app is operating offline or actively syncing
- **FR-013**: System MUST automatically reset each metric's current period value at the start of each new period, preserving all historical log entries
- **FR-014**: Users MUST be able to sign in with an account; each user's metrics and logs are private and inaccessible to other users

### Key Entities

- **User**: An authenticated individual who owns a collection of metrics. Identified by their account credentials.
- **Metric**: A trackable habit belonging to a user. Has a name, type (cumulative / timed / average), timeframe (weekly / monthly), and a current period value derived from log entries in the active period.
- **Log Entry**: An immutable record of a single increment action. Stores the metric reference, the recorded value (integer count for cumulative, duration in whole minutes for timed, integer 1–5 for average), and a timestamp.
- **Sync Queue**: A locally stored ordered list of increment actions that have not yet been uploaded to the cloud. Cleared after successful upload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a new metric in under 30 seconds from the main screen
- **SC-002**: Incrementing a metric (any type) updates the displayed value within 1 second of the user's action
- **SC-003**: All queued offline actions sync successfully within 10 seconds of internet connectivity being restored
- **SC-004**: 100% of increment actions result in a log entry; no data is lost across offline/online transitions
- **SC-005**: Metric period totals reset automatically at the correct time with no manual user action required
- **SC-006**: A timed session's elapsed time remains accurate to within 5 seconds after the app is backgrounded and later foregrounded

## Clarifications

### Session 2026-04-26

- Q: When a timed session is active and the app is force-quit or the device loses power, what should happen to the partial session on next launch? → A: Discard the partial session — no log entry created, timer resets silently.
- Q: Should users be able to reorder metrics on the dashboard, or does creation order fix the display order permanently? → A: Fixed creation order — metrics appear in creation order; no reordering UI.

## Assumptions

- This app is for personal use - there will only ever be one user and only ever on iOS
- No authentication is required
- Each user's data is private; no sharing or collaboration features are in scope
- The app targets a single user per device session; conflicts from simultaneous multi-device edits are resolved by accepting the server's state after sync
- Cumulative metrics increment by exactly 1 per tap; fractional or bulk increments are out of scope
- Average metric entries are restricted to integer values 1–5; the displayed current value is the arithmetic mean of all entries in the current period, rounded to one decimal place
- Only one timed session can be active per metric at a time; starting a new session is blocked while one is already running
- If the app is force-quit or the device loses power during an active timed session, the partial session is silently discarded on next launch; no log entry is created
- Weekly periods begin Monday 00:00 and monthly periods begin on the 1st at 00:00, both in the user's local timezone
- Viewing historical logs is out of scope for this version; logs are stored for future use
- Goal or target values for metrics are out of scope; the app purely tracks and accumulates values
- Editing or deleting existing metrics (name, type, timeframe) is out of scope for this version
- The number of metrics a user can create is unlimited in this version
- Metrics are displayed in creation order; manual reordering is out of scope for this version

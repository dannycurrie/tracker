# Feature Specification: Mindful Minutes Sync

**Feature Branch**: `004-mindful-minutes-sync`
**Created**: 2026-05-05
**Status**: Draft
**Input**: User description: "Using Apple Health mindful minutes data, log to an apple health metric with ID 5dab6c51-bd6c-4a14-9047-cb588889dd7b log the number of minutes from every mindful minutes session since the last sync"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Automatic Mindful Minutes Logging (Priority: P1)

Every time the user completes a mindfulness session (via Headspace, Calm, Apple Breathe, or any Apple Health-compatible app), the session's duration in minutes is automatically logged to the Mindful Minutes metric when the app opens or comes to the foreground. No user action is required.

**Why this priority**: This is the core feature. Without this, nothing else matters.

**Independent Test**: Record a 10-minute mindfulness session in the Health app (or any compatible app) → open the Tracker app → confirm a log entry appears for 10 minutes against the Mindful Minutes metric.

**Acceptance Scenarios**:

1. **Given** a completed mindfulness session of 10 minutes, **When** the app opens or foregrounds, **Then** one log entry of value `10` is created for the Mindful Minutes metric
2. **Given** three mindfulness sessions since the last sync (5 min, 12 min, 20 min), **When** the app foregrounds, **Then** three separate log entries are created — one per session with the respective duration
3. **Given** the same session has already been synced, **When** the app foregrounds again, **Then** no duplicate entry is created
4. **Given** no mindfulness sessions since the last sync, **When** the app foregrounds, **Then** no entries are created and the app behaves normally

---

### User Story 2 — Manual Resync (Priority: P2)

The user can trigger a full resync of mindful minutes data for the current period via Settings → "Sync Apple Health Metrics". This clears and rebuilds the current period's entries from Apple Health, correcting the record if sessions were edited or deleted.

**Why this priority**: Supports data correction without waiting for time-based resolution.

**Independent Test**: Log two sessions auto-sync → delete one from Apple Health → tap "Sync Apple Health Metrics" in Settings → confirm only one entry remains.

**Acceptance Scenarios**:

1. **Given** mindful minutes entries exist for the current period, **When** the user taps "Sync Apple Health Metrics", **Then** the current period's entries are cleared and rebuilt from the latest Apple Health data
2. **Given** Health permission is denied, **When** the user triggers resync, **Then** no error is shown and the app continues normally

---

### User Story 3 — Permission Handling (Priority: P3)

The app requests Health mindful minutes permission as part of the existing permission flow. If denied, mindful minutes sync is silently disabled with no impact on other features.

**Why this priority**: Graceful degradation is required but the core app must work without it.

**Independent Test**: Clear Health permissions in iOS Settings → open app → deny permission → confirm no error appears and other metrics work normally.

**Acceptance Scenarios**:

1. **Given** Health permission has not been granted, **When** the app first opens, **Then** the system prompt includes mindful minutes access (combined with existing workout and sleep permissions)
2. **Given** the user denies permission, **When** the app foregrounds, **Then** no mindful minutes entries are created and no error is displayed

---

### Edge Cases

- What if a mindfulness session has a duration of zero minutes? → Ignore sessions with duration less than 1 minute
- What if multiple apps record the same mindfulness session? → Each source creates a separate Apple Health record with its own unique ID; each will log separately (deduplication by session ID prevents double-counting from the same source)
- What if a session is edited in Apple Health after sync? → Manual resync from Settings corrects the record
- What if the device is offline during a session? → Entries are queued locally and submitted when connectivity returns
- What if a session spans midnight? → The session end time determines the `logged_at` timestamp

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read mindfulness session data from Apple Health on every app foreground event
- **FR-002**: Each mindfulness session MUST produce one log entry with value equal to the session's duration in minutes (rounded to the nearest whole minute)
- **FR-003**: System MUST only process sessions that occurred after the last recorded sync checkpoint
- **FR-004**: Each log entry MUST use the Apple Health session's unique identifier as the log entry ID, preventing duplicates on re-sync
- **FR-005**: Sessions with a duration of less than 1 minute MUST be ignored
- **FR-006**: System MUST advance the sync checkpoint to the end time of the most recently processed session after each sync
- **FR-007**: On first sync, system MUST look back 90 days to capture historical sessions
- **FR-008**: If Health permission is denied, sync MUST exit silently — no error is shown to the user
- **FR-009**: The "Sync Apple Health Metrics" button in Settings MUST clear and rebuild Mindful Minutes entries for the current period
- **FR-010**: Entries created while offline MUST be queued and submitted automatically when connectivity is restored

### Key Entities

- **MindfulSession**: A mindfulness period recorded in Apple Health. Key attributes: unique ID, start time, end time, duration in minutes. Qualifying sessions have duration ≥ 1 minute.
- **MindfulEntry**: A log entry in the tracker representing one mindfulness session. Value is the session duration in whole minutes. Keyed by the Apple Health session ID.
- **SyncCheckpoint**: The end time of the most recently processed session, persisted locally. Prevents reprocessing old sessions on every foreground event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Mindful minutes entries appear within 5 seconds of the app coming to the foreground after a session
- **SC-002**: Zero duplicate entries are created when the same session is processed multiple times
- **SC-003**: Denying Health permission produces zero error messages or disruptions to other app features
- **SC-004**: Manual resync from Settings accurately reflects the current Apple Health mindful minutes data for the active period within 10 seconds

## Assumptions

- The Mindful Minutes metric (`5dab6c51-bd6c-4a14-9047-cb588889dd7b`) is pre-created in the database and will not be auto-created by this feature
- Session duration is logged in whole minutes (rounded), not fractional minutes
- All mindfulness sessions recorded in Apple Health (regardless of source app) are eligible for logging
- Sync fires on app foreground via the existing AppState listener — no new background sync infrastructure is introduced
- Apple Health mindful minutes permission is combined with the existing Workout and Sleep Analysis permissions in a single permission prompt
- "Since the last sync" means since the stored checkpoint timestamp; on first sync this defaults to 90 days ago

# Quickstart: Early Wakeup Log

## Prerequisites

- Native build required (HealthKit not available in Expo Go)
- iPhone with Apple Health sleep data recorded (or manually added)
- Supabase project configured (or `EXPO_PUBLIC_LOCAL_MODE=true` for local mode)
- Metric `1b0558fb-9594-41db-bb2e-bb0f0621b8fc` must exist in the database

## Setup

No additional packages required — `react-native-health` is already installed.

**Rebuild the native project** after adding `SleepAnalysis` to the HealthKit permissions:
```bash
npm run xcode
```
This runs `expo prebuild --clean`, `pod install`, and opens Xcode.

## Adding Test Sleep Data

1. Open the **Health** app on iPhone
2. Browse → Sleep → Add Data
3. Add a sleep entry: start time 10:00pm previous day, end time 6:30am (8.5 hours, wakes before 7am) → should log
4. Add another: start 11:00pm, end 7:30am → should NOT log (after 7am)
5. Add another: start 4:00am, end 6:00am (2 hours) → should NOT log (under 4 hours)

## Testing the sync manually

1. Add qualifying sleep data (≥4 hours, ending before 7am and before 10am)
2. Open the Tracker app
3. The Early Wakeup metric should show a new entry for that day

## Testing manual resync (Settings)

1. Add a sleep entry ending at 6:45am — app foregrounds and logs it
2. Edit that sleep entry in Apple Health to end at 7:15am
3. Open Settings → tap "Sync Apple Health Metrics"
4. Confirm the Early Wakeup entry is removed (was before 7am, now after)

## Permission flow

- On first app open after rebuild, a single system permission sheet covers both Workout and Sleep Analysis
- If denied: sync is silently disabled, all other features unaffected

## Local mode behaviour

When `EXPO_PUBLIC_LOCAL_MODE=true`, sleep sync is disabled — `syncSleepSessions()` returns immediately on the `isLocalMode` guard.

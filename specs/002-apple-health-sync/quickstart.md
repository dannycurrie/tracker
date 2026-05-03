# Quickstart: Apple Health Running Sync

## Prerequisites

- Xcode installed (native build required — HealthKit is not available in Expo Go)
- Physical iPhone or simulator with HealthKit support
- Supabase project configured (or `EXPO_PUBLIC_LOCAL_MODE=true` for local mode)

## Setup

**1. Install the HealthKit library**
```bash
npm install react-native-health
```

**2. Rebuild the native project**
```bash
npm run xcode
```
This runs `expo prebuild --clean`, `pod install`, and opens Xcode. The new `app.json` entries (HealthKit entitlement + Info.plist key) will be applied automatically.

**3. In Xcode — verify Signing & Capabilities**
- Open the `Tracker` target → **Signing & Capabilities**
- Confirm `HealthKit` capability appears (added via `app.json` entitlements)
- Build and run on device

## Environment

No additional environment variables are required for this feature. The feature activates automatically when `react-native-health` is available and the user grants permission.

## Testing the sync manually

1. Record a run in the Apple Health app (or use the Health app → Add Data → Workouts → Running to add a test entry)
2. Open the Tracker app
3. The running distance metric should appear (auto-created on first sync) with the workout logged as an entry

## Local mode behaviour

When `EXPO_PUBLIC_LOCAL_MODE=true`, Health sync is disabled — no permission prompt is shown and no workouts are queried. The local seed data in `localDb.ts` can be extended to include sample running entries for UI development without a device.

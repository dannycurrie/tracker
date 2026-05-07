# tracker Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-07

## Active Technologies
- TypeScript, React Native 0.74.5, Expo SDK 51 + react-native-health (already installed), AppState (built-in), react-native-mmkv (checkpoint storage), existing insertLogEntry + deleteLogEntriesForPeriod services (002-apple-health-sync)
- MMKV — sleep checkpoint (`'sleep:last_sync_at'`), reusing existing `createKV('health-sync')` instance (002-apple-health-sync)
- TypeScript, React Native 0.74.5, Expo SDK 51 + react-native-health (already installed), AppState (built-in), react-native-mmkv (checkpoint storage), existing `insertLogEntry` + `deleteLogEntriesForPeriod` services (002-apple-health-sync)
- MMKV — mindful checkpoint (`'mindful:last_sync_at'`), reusing existing `createKV('health-sync')` instance (002-apple-health-sync)
- TypeScript, React Native 0.74.5, Expo SDK 51 + `@react-navigation/native-stack` (already installed), TanStack Query v5 (already installed), existing `fetchPeriodEntries`/`insertLogEntry` services (main)
- Supabase `log_entries` table (online); MMKV-backed `localDb` (local mode) (main)

- TypeScript (React Native 0.73+) + React Native, Expo SDK 51, TanStack Query v5, react-native-mmkv, Supabase JS v2, Zustand, @react-native-community/netinfo (001-habit-metric-tracker)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript (React Native 0.73+): Follow standard conventions

## Recent Changes
- main: Added TypeScript, React Native 0.74.5, Expo SDK 51 + `@react-navigation/native-stack` (already installed), TanStack Query v5 (already installed), existing `fetchPeriodEntries`/`insertLogEntry` services
- 002-apple-health-sync: Added TypeScript, React Native 0.74.5, Expo SDK 51 + react-native-health (already installed), AppState (built-in), react-native-mmkv (checkpoint storage), existing `insertLogEntry` + `deleteLogEntriesForPeriod` services
- 002-apple-health-sync: Added TypeScript, React Native 0.74.5, Expo SDK 51 + react-native-health (already installed), AppState (built-in), react-native-mmkv (checkpoint storage), existing insertLogEntry + deleteLogEntriesForPeriod services


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

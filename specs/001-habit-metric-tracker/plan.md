# Implementation Plan: Habit Metric Tracker

**Branch**: `001-habit-metric-tracker` | **Date**: 2026-04-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-habit-metric-tracker/spec.md`

## Summary

A personal iOS habit-tracking app allowing a single user to record and review metrics across three interaction types (cumulative tap, timed session, subjective 1–5 average). Current-period values are derived dynamically from an append-only log. Offline actions are queued locally and synced to Supabase when connectivity returns.

## Technical Context

**Language/Version**: TypeScript (React Native 0.73+)
**Primary Dependencies**: React Native, Expo SDK 51, TanStack Query v5, react-native-mmkv, Supabase JS v2, Zustand, @react-native-community/netinfo
**Storage**: Supabase (cloud PostgreSQL), react-native-mmkv (local offline queue and timer state)
**Testing**: Jest, React Native Testing Library
**Target Platform**: iOS 16+
**Project Type**: mobile-app
**Performance Goals**: Metric increment visible within 1 second; offline sync completes within 10 seconds of reconnect; active timer accurate to within 5 seconds after background/foreground cycle
**Constraints**: Offline-capable, single user (no authentication UI required), iOS only
**Scale/Scope**: Single user, personal use, unlimited metrics

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file contains only placeholder template text — no binding principles have been ratified. No gates are applicable. This plan proceeds without constitution violations.

**Post-Design Re-check**: No new violations introduced. Data model is append-only (no destructive writes), consistent with standard mobile app best practices.

## Project Structure

### Documentation (this feature)

```text
specs/001-habit-metric-tracker/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── schema.sql
│   └── query-patterns.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── MetricCard/         # Dashboard card per metric type
│   ├── TimerControl/       # Start/stop timer UI
│   ├── AverageInput/       # 1-5 rating picker
│   └── OfflineBanner/      # Connectivity status indicator
├── screens/
│   ├── DashboardScreen/    # Main metrics list
│   └── AddMetricScreen/    # New metric creation form
├── services/
│   ├── supabase.ts         # Supabase client (anonymous session)
│   ├── metrics.ts          # Metric CRUD
│   ├── logEntries.ts       # Log entry insert + period query
│   └── syncQueue.ts        # Offline queue processor
├── hooks/
│   ├── useMetrics.ts       # TanStack Query — fetch all metrics
│   ├── usePeriodValue.ts   # Derived current-period value per metric
│   ├── useTimer.ts         # Active timer state + elapsed calculation
│   └── useNetworkSync.ts   # Connectivity watcher + queue drain trigger
├── store/
│   ├── offlineQueue.ts     # MMKV-backed pending actions queue
│   └── timerStore.ts       # Zustand — active timer start timestamps
├── utils/
│   ├── periods.ts          # Period window calculation (weekly/monthly)
│   └── averageCalc.ts      # Running mean helper
└── types/
    └── index.ts            # Shared TypeScript types
```

**Structure Decision**: Single mobile-app project (Option 3 variant — iOS-only, no separate API project since Supabase is the backend). All app source lives under `src/`; Expo config at project root.

## Complexity Tracking

> No constitution violations — table not required.

# PRD: Database lockdown

**Status**: Draft. Problem recorded; the design hasn't been through grilling yet.
**Date**: 2026-10-24
**Found during**: `plans/008-metrics-api/01-verify-live-db.md`

## Problem

Nothing restricts access to the production Supabase DB:

- RLS is off on `metrics` and `log_entries`.
- There's no `user_id` column, and `auth.users` is empty. The app never signs in: `App.tsx` calls `getSession()` but never `signInAnonymously()`. The anonymous-auth design in spec 001 was never wired up.
- The anon key ships in the app bundle as `EXPO_PUBLIC_SUPABASE_ANON_KEY`. With no session at all, it can read all 9 metrics and all 465 log entries (verified 2026-10-24). Writes and deletes are presumably open too (not tested).

Anyone who pulls the anon key out of the app bundle can read, change or delete all tracker data.

## Goal

Only the owner's devices, and the Metrics API, can read or write the data.

## Constraints

- The Metrics API (`prds/008-metrics-api.md`) uses the secret key, which bypasses RLS. It must keep working unchanged.
- The app has offline queues and caches (`offlineQueue`, `offlineCache`) and a local mode. Signing in must not break offline-first use.
- Existing rows have no owner, so they need a backfill.

## Options (to grill)

1. **Anonymous sign-in, a `user_id` column and RLS.** This is the original spec 001 design. The risk: every reinstall creates a new user, which orphans the data unless the account gets linked to an identity.
2. **A real login** (email magic link or Sign in with Apple), then a `user_id` column and RLS. This survives reinstalls and allows multiple devices.
3. **Minimal lockdown**: turn RLS on with an `auth.uid() = <owner uid>` policy, using one pre-created account the app signs into. No schema change, but it's a hack.

## Open questions

- Which option?
- How should existing rows be backfilled with an owner?
- Should anonymous sign-ins be disabled in the Supabase project if they aren't used?
- Should the anon key be rotated after the lockdown, since it may already be extracted from shipped builds?

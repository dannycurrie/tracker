# 01: Verify live DB schema and resolve user ID

**What to build:** Confirm that the PRD's assumptions about the live Supabase database are true before any server code depends on them. The schema contract in the repo is stale: it has no `user_id`, `source` or `checklist_items` columns. Also, every app reinstall creates a new anonymous user, so the owner's data may be split across several user IDs.

**Blocked by:** None (can start immediately). Needs the owner to add `SUPABASE_SECRET_KEY` to `server/.env` first.

**Status:** done (2026-10-24)

- [x] `server/.env` exists and is gitignored. It holds the secret key and no `EXPO_PUBLIC_*` variables.
- [x] The live columns and types for `metrics` and `log_entries` are dumped, including `user_id`, `source` and `checklist_items`.
- [x] The live RLS policies on both tables are recorded. (There are none: RLS is off, as the owner confirmed.)
- [x] The repo's schema contract is updated to match the live DB.
- [x] `auth.users` is listed along with how many metrics each user owns. (It's empty, and there's no `user_id` column. Decision: the DB is single-tenant and `USER_ID` is dropped.)
- [x] Anything that contradicts the PRD (missing columns, unexpected policies, value types) is raised with the owner before ticket 02 starts. The PRD's open items are updated with the outcome.

**Outcome:** see the PRD's "Live DB findings" section. Locking down the DB is split out into `prds/009-db-lockdown.md`, which doesn't block this plan.

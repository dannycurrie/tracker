# 02: Tracer bullet: authenticated `/v1/metrics` on Vercel

**What to build:** A deployed Express server, in its own `server/` package, that answers `GET /v1/metrics?from=&to=` in production. It authenticates the caller, validates the window, and returns all of the owner's metric definitions from the live DB with an empty `periods` array for each. This proves the whole path end to end: auth, config, Supabase access with the secret key, response shape, logging and deployment. Later tickets only fill in `periods`.

**Blocked by:** 01

**Status:** done (2026-10-24). Live at https://tracker-metrics-api.vercel.app

- [x] A missing or wrong `Authorization: Bearer` key returns 401. The key is compared in constant time.
- [x] `from` and `to` are required and must be ISO-8601 with an offset or `Z`. `from` must be before `to`, and the range can be at most 2 years. A violation returns 400. A future `to` is accepted.
- [x] Every error uses the body `{ error: { code, message } }`, and Supabase internals are never exposed. A missing server config returns 500.
- [x] The 200 response includes `from`, `to`, `timezone` and `metrics[]`, in `display_order`, with `id`, `name`, `type`, `timeframe`, `source`, `unit` (`"minutes"` for timed, otherwise `null`) and `periods: []`.
- [x] Metrics are fetched with the secret key. The DB is single-tenant, so there's no user filter, and the API key is the only access control. Metrics created after `to` are left out.
- [x] Responses send `Cache-Control: no-store` and no CORS headers.
- [x] Each request writes one structured JSON log line (method, path, status, duration). The key and response body are never logged.
- [x] Route tests (Supertest over an injected fake data layer) cover auth, every validation rule, the error shape and the response shape.
- [x] There is a Vercel project with Root Directory `server/` and files outside the root included. It deploys to production on push to `main`, and its secrets are set for Production only.
- [x] Demo: `curl` against the production URL returns 401 without the key and the metric list with it.

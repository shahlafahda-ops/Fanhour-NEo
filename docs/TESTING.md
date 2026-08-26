# Testing

## Unit / integration (Vitest) — `npm test`
Pure domain logic, framework-free. Current suite: **55 tests, all passing**.

| File | Covers |
|---|---|
| `domain/retention.test.ts` | MRAF/QMP cases A–E, buckets, new-vs-returning |
| `domain/eligibility.test.ts` | fixture-linked eligibility, regulated-prize guard, launch readiness |
| `domain/fixture.test.ts` | server-side state machine, result grading |
| `domain/redemption.test.ts` | outcome mapping, simulated atomic single-use |
| `domain/community.test.ts` | min-sample honesty, sums to 100 |
| `security/security.test.ts` | OTP valid/wrong/expired/replay/resend, tokens, phone E.164 |
| `analytics/events.test.ts` | PII stripping, server-authoritative set |
| `config/env.test.ts` | production safety guards |

## DB invariant checks (Postgres)
The migrations and SQL functions were applied to a real Postgres 16 during
build and exercised for: campaign cap enforcement (`cap_reached`), single-use
redemption (`redeemed` then `already_redeemed`), one-prediction-per-identity,
one-claim-per-campaign, the regulated-prize activation guard, and idempotent
resolution grading. To reproduce, apply `supabase/migrations/*.sql` to a
database and run the checks in the "DB invariant" section of the build log /
your own harness.

## End-to-end (Playwright) — `npm run test:e2e`
Specs in `tests/e2e` cover the fan journey (land → predict → record), portal
authentication walls (ops/merchant show login, leak no data), and legal pages.

**Prerequisites:** a running app (`npm run build && npm start`) pointed at a
Supabase project with `npm run seed` loaded, and `E2E_BASE_URL` set. Chromium is
pre-installed; set `PLAYWRIGHT_CHROMIUM_PATH` if needed. E2E is **not** run in
this offline build because it requires live Supabase Auth + SMS provider.

## Final QA checklist (pre-release)
Clean install → migrate → `typecheck` → `lint` → `test` → `test:e2e` →
`build` → inspect console → mobile viewport → expired-fixture, prediction-change,
OTP-abuse, duplicate-claim, duplicate-redemption, unauthorized-admin,
unauthorized-merchant → confirm no test data in prod → confirm no secrets in the
client bundle.

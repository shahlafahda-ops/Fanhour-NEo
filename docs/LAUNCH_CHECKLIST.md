# Launch Checklist — Al Hazem Pilot 1

Production is **not GO** until every required item is satisfied. Items marked
🔴 are external dependencies FanHour must supply before launch; 🟢 are built and
verified in this codebase.

## Product & content
- 🔴 Real Al Hazem fixtures entered with correct Riyadh kickoff times
- 🔴 Approved FanHour brand assets + Al Hazem crest (currently neutral placeholders)
- 🔴 Approved Privacy Policy copy (`/privacy` shows `REQUIRES_APPROVED_LEGAL_COPY`)
- 🔴 Approved Platform Terms copy (`/terms` shows `REQUIRES_APPROVED_LEGAL_COPY`)
- 🔴 Final campaign partner + campaign terms, cap, and expiry
- 🔴 Benefit fulfilment confirmed with the merchant
- 🟢 Fixture create/resolve workflow (ops)
- 🟢 Campaign launch guard (required fields must be set before activation)

## Identity & security
- 🔴 OTP provider credentials configured; `OTP_PROVIDER` ≠ `mock`
- 🔴 Notify provider credentials configured; `NOTIFY_PROVIDER` ≠ `mock` (reminders are otherwise inert)
- 🔴 `CRON_SECRET` set and an external scheduler (Netlify Scheduled Function, cron-job.org, …) calls `POST /api/cron/reminders` every 15–30 min
- 🔴 Dedicated `HASH_PEPPER` secret set (not the service-role fallback)
- 🟢 Secure OTP generation/hashing/rate-limiting
- 🟢 Service role server-only; RLS default-deny on sensitive tables
- 🟢 Ops RBAC + scoped merchant auth

## Merchant fulfilment
- 🔴 Merchant staff accounts created and access granted to the campaign
- 🔴 Successful end-to-end merchant redemption test on production data
- 🟢 Atomic single-use redemption + concurrency safety
- 🟢 Merchant sees status only, never PII

## Data & compliance
- 🔴 `ALLOW_TEST_DATA=false` in production and DB contains no test rows
- 🔴 Live campaign reviewed by FanHour's own legal counsel before activation (outside this codebase)
- 🟢 `assertProductionSafety()` guard (fails mock OTP / test data in prod)
- 🟢 Consent versioning, data-minimisation copy, withdrawable marketing consent

## Operational
- 🔴 First `super_admin` ops account created and secured
- 🔴 Support destination (`SUPPORT_DESTINATION`) configured
- 🟢 Audit logging on sensitive mutations
- 🟢 Analytics dashboard (MRAF/QMP + commercial funnel)

## Engineering gates (verified in this build)
- 🟢 `npm run typecheck` clean
- 🟢 `npm run lint` clean
- 🟢 `npm test` — 191/191 passing
- 🟢 `npm run build` — succeeds (28 routes)
- 🟡 `npm run test:e2e` — specs written; run against a live seeded environment

## Pilot 1 retention layer
- 🟢 XP, rank ladder, fixture streak, enhanced record page
- 🟢 Commentary reaction engine (`commentary_reactions` ON; two phrases deferred)
- 🟢 Resolved-match progression screen
- 🟢 Lifecycle segmentation + Ops status/retention/commentary panels
- 🔴 Review rank thresholds against live data after ~4 fixtures and rebalance
- 🔴 Recruit the four research cohorts in [PILOT_RESEARCH.md](./PILOT_RESEARCH.md)
- 🟡 Confirm commentary fires sensibly via the Ops diagnostic counts (not a KPI)

## Part A — pilot measurement layer
- 🟢 Matchweek reminders + randomised 80/20 treatment/holdout (`notification_timing` ON by default; inert without `NOTIFY_PROVIDER` + `CRON_SECRET` + an external scheduler)
- 🟢 `?src=` acquisition attribution + planned/delivered club touchpoints per fixture
- 🟢 Honest commercial funnel (eligible population as the claim-rate denominator) + `benefit_blocked` reason codes
- 🟢 Verified Reach Index (VRI) + merchant first-visit tap + `/ops/sponsor-report/[campaignSlug]`
- 🟢 Measured per-fixture ops effort (question set / verification / resolution / sponsor reporting minutes)
- 🟢 XP/rank thresholds tunable via `feature_flag.progression_config` — no deploy needed to rebalance
- 🔴 Recruit ~30+ reminder subscribers per arm before reading the treatment-vs-holdout MRAF split (see Ops dashboard's "sample too small" flag)

## Recommendation
**CONDITIONAL GO** — the software is production-quality and the required
corrections are implemented and tested. Launch is gated on the 🔴 external
items above (real fixtures, approved legal copy & assets, live OTP provider,
signed campaign terms, merchant accounts, and a production DB free of test data).

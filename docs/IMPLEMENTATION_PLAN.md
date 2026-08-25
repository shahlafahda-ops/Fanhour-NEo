# Implementation Plan

## 1. Chosen architecture
Next.js 14 App Router (mobile web) + Supabase (Postgres, RLS, Auth, SQL
functions). Server owns all trust decisions; the browser holds only the anon
key and an anonymous session cookie. TypeScript strict throughout.

## 2. Repository layout
```
src/
  app/                    # routes (fan, ops, merchant, legal, api)
  components/             # shared React UI (RTL, accessible)
  lib/
    domain/               # PURE business logic + unit tests (framework-free)
    security/             # OTP, tokens, phone, rate limit
    data/                 # server read models (fixtures, campaigns, analytics…)
    identity/             # anon session, supporter, cross-device merge
    auth/                 # ops/merchant guards
    analytics/            # event taxonomy + authoritative recorder
    config/               # env guards, feature flags
    supabase/             # admin (service role), server (auth), browser clients
    i18n/                 # Arabic copy + Riyadh formatting
supabase/migrations/      # committed SQL (schema, RLS, functions, base data)
supabase/seed.sql         # DEV-only, clearly-labelled test data
tests/e2e/                # Playwright specs
legacy/                   # preserved NEOM prototype (non-authoritative)
```

## 3. Database model
See [DATA_MODEL.md](./DATA_MODEL.md). Three domain boundaries — identity/contact,
behavioural activity, commercial fulfilment — with critical invariants enforced
by DB constraints and concurrency-safe SQL functions.

## 4. Authentication approach
- **Fans**: no login for the core loop. First-party anonymous UUID cookie.
- **Verified supporters**: Saudi mobile OTP at claim time only.
- **Ops / Merchant**: Supabase Auth (email/password) mapped to `ops_user` /
  `merchant_user`; authorization enforced server-side and via RLS.

## 5. Anonymous → verified identity model
Anonymous session cookie → predictions attached to it → at benefit claim, OTP
verification resolves-or-creates a `supporter`, and anonymous activity is
merged into it without duplicating fixture participation (DB unique index
guarantees one qualified prediction per identity per fixture).

## 6. OTP design
`crypto.randomInt` 6-digit codes, hashed server-side (peppered + challenge-bound),
5-min TTL, single use, attempt/resend/request rate limits. Provider abstraction
(`mock`/twilio/unifonic); `mock` hard-fails in production.

## 7. Analytics design
Stable snake_case taxonomy. Business-critical events (issuance, redemption,
resolution) are recorded authoritatively by the server after the atomic
operation — never double-counted from the browser. QMP/MRAF computed from the
prediction table (distinct fixtures), not page views.

## 8. Merchant redemption design
Opaque 192-bit token (QR) + high-entropy fallback code; only hashes stored.
Redemption is an atomic `UPDATE … WHERE status='issued'` in a SQL function, so
concurrent scans can never double-redeem. Merchants are scoped to their
campaigns and never see PII.

## 9. Operations portal design
RBAC (`super_admin`/`ops`/`analyst`/`support`). Fixture CRUD + resolution,
campaign configuration with a launch-readiness guard (regulated prizes blocked
without explicit legal approval), merchant/staff management, analytics
dashboard. Every sensitive mutation writes an audit log row.

## 10. Testing strategy
Pure domain logic covered by Vitest (MRAF/QMP, eligibility, redemption, OTP,
community, fixture state, production guards). DB invariants validated against a
real Postgres. Playwright covers the fan/merchant/ops journeys. See
[TESTING.md](./TESTING.md).

## Build order followed
Domain + DB → infrastructure → fan journey → APIs → portals → docs/tests/hardening.

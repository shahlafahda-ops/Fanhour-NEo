# Architecture

## Principles
- **Server owns trust.** Fixture state, eligibility, OTP, redemption, and caps
  are decided server-side. The client clock never determines eligibility.
- **Value before identity.** The core prediction needs no login. Identity is
  requested only to save a record across devices or claim a benefit.
- **Thin platform.** FanHour is a technology + managed-operations layer, not a
  club CRM, wallet, or marketplace.

## Layers
1. **Presentation** (`src/app`, `src/components`) — RTL Arabic mobile web.
   Server Components fetch read models; small Client Components handle the
   prediction tap, claim flow, and portals.
2. **Domain** (`src/lib/domain`) — pure, framework-free functions with unit
   tests: fixture state, result grading, retention (QMP/MRAF), eligibility,
   community distribution, redemption outcome mapping.
3. **Application services** (`src/lib/{data,identity,analytics,security,otp}`) —
   orchestrate domain logic with Supabase.
4. **Persistence** (`supabase/migrations`) — Postgres with RLS, constraints,
   and concurrency-safe SQL functions.

## Trust & clients
| Client | Key | Reaches |
|---|---|---|
| Browser (fan) | anon key + `fh_sid` cookie | public reads via RLS; all writes go through server API routes |
| Server API / RSC | service role | full DB (bypasses RLS) — trusted business logic only |
| Ops / Merchant browser | anon key + Supabase Auth session | RLS-scoped reads (`is_ops`, `merchant_can_access_campaign`) |

`src/lib/supabase/admin.ts` is `import 'server-only'` so the service role can
never be bundled into client code.

## The fixture state machine
`scheduled → open → locked → resolved` (or `cancelled`). Effective status is
computed from stored status + time windows in `effectiveFixtureStatus`; a
terminal stored status always wins. Predictions are editable only while `open`.
All times are handled in `Asia/Riyadh`.

## Identity
Anonymous UUID cookie (`fh_sid`, httpOnly) → `anonymous_session`. On OTP
verification a `supporter` is resolved-or-created and the session + its
predictions merge into it. Contact PII lives only in `supporter_contact`,
keyed separately from behavioural tables.

## Brand
FanHour owns the digital experience; Al Hazem provides the supporter context —
the header reads **فان أور × الحزم**. FanHour green `#00E676` and purple
`#6515EE` are the platform identity; Al Hazem colours are contextual accents
(`hazem.*` tokens, currently neutral placeholders pending approved assets).

## Feature flags
DB-backed (`feature_flag`) with safe code defaults (`src/lib/config/flags.ts`).
`cohort_status`/`matchweek_status` ship OFF. Global leaderboard and daily streak
do not exist in the codebase.

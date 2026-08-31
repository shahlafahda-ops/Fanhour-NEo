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

## Status, streak and commentary (Pilot 1 retention layer)

Four pure domain modules, all unit-tested and free of framework code:

| Module | Responsibility |
|---|---|
| `domain/progression.ts` | XP table, rank ladder, progress, rank advancement |
| `domain/streak.ts` | Fixture participation streaks (never daily streaks) |
| `domain/lifecycle.ts` | Transparent rule-based segmentation (internal Ops only) |
| `domain/commentary.ts` | Deterministic commentary reaction selection |

### The rank ladder
`متابع → مشجع → محلل خبير → محلل مخضرم → أسطورة` at **0 / 60 / 150 / 260 / 380
XP**. XP: participation +10, correct outcome +20, exact score +20 (max 50 per
fixture). Calibrated for ~11–12 usable fixtures in the 90-day window.

Deliberate property: **participation alone caps a supporter at مشجع**
(12 × 10 = 120 < 150). محلل خبير and above must be earned with prediction
accuracy, so the ladder reads as football credibility rather than attendance.
All values live in one place and are documented for post-pilot rebalancing.

### Commentary reactions are microcopy, not badges
They are transient contextual reactions — **not** badges, achievements,
collectibles, trophies, inventory or unlockables. They carry **no XP, no rank
effect and no sponsor-benefit implication**.

`evaluateCommentaryReaction(context)` returns at most **one** reaction or
`null`. Priority: exact score → rarity → admiration. Community-based reactions
require a real sample (`hasEnoughSample`); rarity is never fabricated. Phrases
that could recur (`يا رباه!`, `عيني عيني!`) are suppressed back-to-back.

**Deferred in Pilot 1:** `يوززززززع!` needs a genuine distribution/share
interaction and `الضربة القاضية ممكن!` needs a decisive late-match context.
Neither exists in a pre-match-only pilot, so both are flagged unavailable rather
than forced — no mechanic was invented to accommodate a phrase.

### Two value systems, kept apart
FanHour **status** is earned through participation and prediction skill.
**Sponsor benefits** are partner-provided value. XP never influences
`evaluateEligibility`, and no XP is awarded for claiming, redeeming, spending or
registering. A unit test guards this separation.

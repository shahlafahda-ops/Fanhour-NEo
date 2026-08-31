# Analytics

## Philosophy
The unit of engagement is a **fixture**, not a day. We do not optimise for DAU.
Core question: *do activated supporters return for another Al Hazem fixture?*

## North Star — MRAF
**Matchweek Returning Activated Fan**: an identity that completed the core
prediction in **two or more distinct eligible fixtures**. Opening a page,
re-viewing a fixture, or viewing the profile does not count. Implemented in
`src/lib/domain/retention.ts` and unit-tested (cases A–E, prompt §69).

## QMP
**Qualified Match Participation** = distinct eligible fixtures with a completed
core prediction. Five edits in one fixture = QMP 1. Buckets QMP-1/2/4/8 shown on
the dashboard, computed from the `prediction` table (authoritative), not events.

## New vs returning
"Returning" requires ≥1 **prior** distinct qualified fixture — never the mere
presence of `localStorage`/cookie.

## Event taxonomy
Stable snake_case names in `src/lib/analytics/events.ts` (fixture_viewed,
prediction_submitted, otp_verified, benefit_issued, redemption_validated, …).

### Single source of truth
Business-critical events are **server-authoritative** (see `SERVER_AUTHORITATIVE`):
`prediction_submitted/updated/resolved`, `otp_*`, `benefit_issued`,
`redemption_validated/failed`, `consent_*`. They are emitted by the server after
the underlying atomic operation. UI telemetry (viewed/started/clicked) may be
client-side. No business event is double-counted from the browser.

### Property hygiene
`sanitizeProps()` strips forbidden keys (`phone`, `otp`, `token`, …) before any
event is written. Raw phone/OTP/token never enter analytics.

## Dashboard (/ops)
Activation (views, completions, completion rate), Retention (MRAF, QMP-1/2/4/8),
Commercial funnel (benefit views → OTP verify → issued → redeemed, claim→redemption
%), Fulfilment (failed redemptions, support requests). Distribution touchpoints
(`distribution_touchpoint`) let ops separate product performance from
distribution reach.

## Pilot 1 retention / status layer

**Two activation moments** are instrumented separately, because the pilot needs
to learn which one predicts return:
- **Activation 1 — First Play**: `first_value_reached`, the first qualified
  prediction by an identity.
- **Activation 2 — First Resolution**: `first_resolution_viewed`, the supporter
  returning after a fixture resolved to see their outcome.

**Time to first value** is the median of `first_value_reached − fixture_viewed`
per identity. Both timestamps are recorded **server-side**; client-only timing
would not be trustworthy. `fixture_viewed` is written at most once per
identity+fixture (`recordEventOnce`) so a page refresh cannot inflate the funnel.

**New events**: `first_value_reached`, `first_resolution_viewed`,
`status_viewed`, `rank_advanced`, `fixture_streak_viewed`,
`matchweek_status_viewed`, `commentary_reaction_shown`.

`commentary_reaction_shown` stores the **reaction key only**
(`BEL_MILLIMETER`, `YA_RABAAH`, `AYNI_AYNI`, `YWAZZAA`, `KNOCKOUT_POSSIBLE`)
plus a short machine reason — never free text, never PII.

**Fixture-to-fixture depth**: F1→F2, F2→F3, F3→F4 are computed from distinct
QMP depth, not sessions. Streak, rank and lifecycle distributions are derived
per identity at read time.

**Comparisons are analytical only.** Rank, XP, streak and lifecycle may be
cross-tabulated against the commercial funnel, but they never modify benefit
eligibility, and rank must never be presented as commercial worth.

**Research cohorts** for the human feedback loop are defined in
[PILOT_RESEARCH.md](./PILOT_RESEARCH.md).

## Exports
Authorized ops users can build CSV exports (funnel, anonymised participation,
claims, redemptions, fulfilment). Phone numbers are never exported by default.

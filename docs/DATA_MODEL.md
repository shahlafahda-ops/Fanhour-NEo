# Data Model

Migrations live in `supabase/migrations` and are applied in order:
`0001_core_schema` → `0002_commercial_schema` → `0003_otp_and_functions` →
`0004_rls` → `0005_base_data`.

## Domain boundaries
- **Identity / contact**: `supporter`, `supporter_contact` (PII), `consent`,
  `anonymous_session`.
- **Behavioural activity**: `prediction`, `prediction_change`, `event`.
- **Commercial fulfilment**: `sponsor`, `campaign`, `merchant`,
  `merchant_location`, `merchant_user`, `campaign_merchant`, `claim`,
  `redemption_log`.
- **Operations / platform**: `club`, `fixture`, `ops_user`, `feature_flag`,
  `audit_log`, `support_ticket`, `distribution_touchpoint`, `otp_challenge`,
  `rate_limit`.

## Key tables (selected)
### fixture
Windows `prediction_open_at ≤ cutoff_at ≤ kickoff_at` (CHECK). `resolved`
requires both scores + result (CHECK). `is_test` flag.

### prediction
One authoritative qualified prediction per identity per fixture — enforced by
two partial unique indexes (by `supporter_id`, by `anonymous_session_id`).
Edits update the same row; `prediction_change` audits them. **QMP counts
distinct fixtures here — never edits.**

### supporter / supporter_contact
`supporter` carries no PII (verified flag, age eligibility, locality).
`supporter_contact` holds `phone_e164` + a unique peppered `phone_lookup_hash`
for cross-device dedupe without exposing the number.

### campaign
`compliance_mode` ∈ {engagement_only, participation_benefit, regulated_prize}.
CHECK `campaign_regulated_requires_approval` forbids activating a regulated
prize without `legal_approval_status='approved'`. CHECK
`campaign_active_needs_fixture` forbids an active benefit campaign with no
fixture. `issued_count ≤ issue_cap` (CHECK). Eligibility mode defaults to
`fixture_participation`.

### claim
`token_hash` (unique) = SHA-256 of a 192-bit opaque token; `fallback_code`
(unique) is a high-entropy human code. `unique(campaign_id, supporter_id)` →
one claim per supporter per campaign. Status ∈ {issued, redeemed, expired, void}.

## Concurrency-safe functions
- `issue_claim_atomic` — row-locks the campaign, enforces the cap, inserts the
  claim, increments `issued_count`. Raises `cap_reached` / `campaign_inactive`.
- `redeem_claim_atomic` — `UPDATE … WHERE status='issued'` flips exactly one
  row; returns `redeemed` / `already_redeemed` / `expired` / `void` /
  `campaign_paused` / `not_found`; always logs to `redemption_log`.
- `resolve_fixture_atomic` — sets scores/result, grades all predictions
  idempotently.
- `increment_rate_limit` — atomic fixed-window counter.

## Verified against a live Postgres
Cap enforcement, single-use redemption, prediction/claim uniqueness, and the
regulated-prize guard were exercised against a real Postgres 16 instance during
build (see docs/TESTING.md → "DB invariant checks").

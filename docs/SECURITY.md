# Security

## Threat model & mitigations
| Threat | Mitigation |
|---|---|
| Unauthorized ops dashboard access | Supabase Auth + `ops_user` RBAC; server `requireOps()`; RLS `is_ops()`; no data rendered pre-auth |
| Unauthorized merchant redemption | Authenticated `merchant_user`; redemption scoped via `campaign_merchant`; server checks before `redeem_claim_atomic` |
| Brute-force OTP | 6-digit crypto codes, hashed + peppered, 5-min TTL, ≤5 attempts, resend cooldown, ≤5 requests/number/hour |
| Brute-force fallback code | 40-bit code, per-merchant rate limit on code lookups, no DB id encoded |
| Redemption replay / double spend | Atomic single-use `UPDATE … WHERE status='issued'` |
| Campaign cap race | `issue_claim_atomic` row-locks campaign + increments in one tx; DB CHECK `issued_count ≤ issue_cap` |
| Mass fake predictions | Server-gated writes, one prediction per identity per fixture, rate limits available per endpoint |
| SQL injection | Parameterised Supabase queries / RPC only |
| XSS | React escaping; no `dangerouslySetInnerHTML` except vetted approved legal HTML |
| Exposed service key | `import 'server-only'` on admin client; never `NEXT_PUBLIC_` |
| Leaked PII | Merchants see status only; analytics strips forbidden keys; phone stored apart from behaviour |
| Admin privilege escalation | Roles enforced server-side + RLS; audit log on role-sensitive actions |
| Insecure prod config | `assertProductionSafety()` + OTP provider hard-fail on `mock` |

## Secrets
`SUPABASE_SERVICE_ROLE_KEY` and OTP credentials are server-only. `.env*` is
gitignored; `.env.example` documents every variable with placeholders.

## PII handling (PDPL-ready)
Data minimisation by default: no name, no phone for the core prediction.
Phone captured only at claim, stored in `supporter_contact`, never in
behavioural tables or analytics. Consent is versioned, per-type, and
withdrawable. Mechanisms exist for deletion/access requests and configurable
retention (see LEGAL_CONFIGURATION.md).

## Headers
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, and a
`Permissions-Policy` disabling geolocation/microphone (camera allowed for the
merchant scanner) are set in `next.config.mjs`.

## Residual items before launch
- Wire the real OTP provider (adapter stubs raise `*_not_implemented`).
- Set a dedicated `HASH_PEPPER` secret (currently falls back to the service key).
- Add Supabase Auth session-refresh middleware if ops/merchant sessions should
  auto-renew across long shifts.

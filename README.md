# FanHour × Al Hazem — Pilot 1

Arabic-first, RTL mobile web for the Al Hazem FC pilot (Al Rass / Qassim).
Built to the *FanHour | Al Hazem Pilot Execution Pack* v03, Appendix B
("SUPER FINAL Technical & Behavioral Product Freeze").

> **Launch status: CONDITIONAL NO-GO.**
> This codebase does not decide that. `GET /api/admin/launch-readiness` reports
> the section 21 pre-launch gate and will keep returning `CONDITIONAL NO-GO`
> until every technical check passes and every contractual, legal and privacy
> gate is attested. See [Launch readiness](#launch-readiness).

## The loop

```
club/creator/merchant link
  → Arabic RTL landing (club leads, sponsor secondary)
  → 3-question challenge          ← no identity, no phone, no OTP
  → result + accuracy + feedback  ← no identity, no phone, no OTP
  → optional matchweek status     ← no identity, no phone, no OTP
  → score-independent sponsor benefit revealed
  → claim intent
  → 18+ · coarse locality · Saudi mobile · required acceptance
  → OTP
  → single-use claim (QR + short code)
  → merchant web validator
  → next-fixture return cue
```

The first four steps collect nothing personal. That ordering is the spec's
controlling rule — prove value before asking for identity — and the acceptance
tests assert it.

## Running it

```bash
npm install
npm run seed        # fixtures F1–F10, an open F1 challenge, a demo sponsor/offer
npm run dev:api     # API on :8787
npm run dev         # UI on :5173, proxying /api to :8787
```

Single-process (serves the built UI from the API):

```bash
npm run build && npm start     # http://localhost:8787
```

| Surface | Path | Notes |
|---|---|---|
| Fan challenge | `/` | Arabic, RTL |
| Merchant validator | `/merchant` | demo staff `staff_demo` / PIN `1234` |
| Live value board | `/board?k=…` | projector surface, key-gated, aggregate only |
| Admin API | `/api/admin/*` | header `x-fh-admin-key` |

## Demo

See **[DEMO.md](DEMO.md)** for the full runbook. Short version:

```bash
npm run demo:start -- --force
```

Builds, seeds fixtures and prior engagement, starts in demo mode, and prints the
board / fan / merchant URLs on your LAN address so phones in the room can reach
them. `--force` is required because it deletes the local database.

The board at `/board?k=…` answers the pitch question — *التفاعل موجود، لكن كيف
يتحول إلى قيمة؟* — with three beats: the engagement on the right, the question
in the middle with a join QR, the converted value on the left. It polls every
two seconds, so it fills while the room plays.

`FH_DEMO=1` shows the OTP on the fan's screen so the journey can be filmed
without a live SMS route. It renders as an obvious scaffold, the API response is
flagged `demoMode: true`, and the launch gate reports **FAIL** while it is set.
`POST /api/admin/demo/reset` clears fan activity between runs without touching
fixtures, challenges or commercial configuration.

The board is **not** the club/sponsor self-serve dashboard the spec forbids: it
is FanHour-operated, key-gated, aggregate-only, has no club login and no
per-sponsor drill-down, and is not a contractual reporting deliverable. Sponsor
reporting stays manual (section 16).

## Tests

```bash
npm test
```

43 tests. `acceptance.test.js` covers the Appendix B9 gate and the B4
controls: server-authoritative scoring, answer immutability, OTP attempt and
resend limits, concurrent cap safety, idempotent issue/redeem, PII absence in
the validator and in analytics, locality cell suppression, and the launch gate.
`demo-board.test.js` covers the board and demo surfaces: key separation, that
the board leaks no fan identifier, that its figures reconcile with the database,
that demo traffic runs through the real code paths rather than writing
fabricated metrics, and that demo mode cannot be shipped on.

## What the database enforces

Application code can be wrong; these cannot be bypassed by it.

| Rule | Mechanism |
|---|---|
| One claim per verified fan/offer | `UNIQUE (fan_id, offer_id)` on `claims` |
| One verified result per fan/fixture | composite PK on `verified_results` |
| Offer capacity | conditional `UPDATE … WHERE claimed_count < cap_total` |
| One redemption per claim | `UNIQUE claim_id` on `redemptions` |
| Retry safety | `idempotency` table keyed per claim issuance |
| No answer mutation | `UNIQUE (session_id, question_id)` on `answers` |

Concurrency is covered by a test that fires ten simultaneous claims at a
cap of three and asserts exactly three are issued.

## Privacy

Per section 5 and the Day-0 data model:

- Phone numbers are stored **only** as an HMAC (`FH_PHONE_PEPPER`), never raw.
- Locality is the coarse four-way category — **no GPS, postcode, address or
  national ID**, and there are no columns for them.
- Analytics events are scrubbed of PII-shaped keys, and the B5 event taxonomy is
  frozen: an unknown event name throws rather than silently widening the schema.
- The merchant validator never receives a fan identifier or phone number.
- Reporting cells below 10 are suppressed.
- Marketing consent is separate, optional, unchecked by default, and never a
  condition of receiving a benefit.

## Configuration

Copy `.env.example` and set real values before any non-local deployment.

| Variable | Purpose |
|---|---|
| `FH_PHONE_PEPPER` | HMAC key for phone hashing. **Rotating it orphans every existing fan record.** |
| `FH_ADMIN_KEY` | Guards `/api/admin/*`. |
| `FH_DATA_DIR` | SQLite location (default `./data`). |
| `FH_RATE_LIMIT` | Per-IP requests/minute (default 120; `0` disables). |
| `FH_BOARD_KEY` | Guards `/api/board` and the `/board` screen. |
| `FH_DEMO` | `1` enables demo mode. **Fails the launch gate.** Never set in production. |
| `PORT` | API port (default 8787). |

## Known gaps before Day 0

These are deliberate and tracked, not oversights:

1. **SMS/OTP is a stub.** `server/lib/sms.js` ships `MockSmsProvider`, which
   records codes in memory. Appendix B8 classifies SMS as *buy*, not *build*. A
   licensed provider must be implemented against the same interface and reviewed
   under PDPL. The launch gate fails while the stub is in use.
2. **Fixtures F2, F3, F5–F9 have no confirmed opponent.** Only F1 (Al Ahli away),
   F4 (Al Hilal away) and F10 (Al Qadisiyah home) are verified against official
   SAFF pages. The spec forbids inventing the rest; they carry
   `opponent_confirmed = 0` and must be completed from the final official
   schedule.
3. **Challenge content is placeholder.** Only F1 has a bespoke question set. All
   content needs club approval before its fixture opens.
4. **Prediction questions are not built.** B10 defers delayed-settlement
   predictions to a later controlled test; they need a `PENDING → SETTLED` state,
   an official result source and a void/correction path.
5. **Sponsor reporting is manual by design.** The admin endpoints produce report
   *inputs*. The spec explicitly forbids a self-serve sponsor dashboard.
6. **Staff auth is in-memory.** Merchant sessions live in a `Map` and are lost on
   restart. Fine for a single-process pilot; needs a shared store if scaled out.
7. **No push notifications.** The return cue is the football calendar plus
   club-owned distribution and an optional consented reminder. Streaks and push
   loops are on the do-not-build list.
8. **Demo sponsor, offer, outlet and staff PIN are illustrative**, not signed
   deals. Replace them before showing this to a real merchant.

## Launch readiness

```bash
curl -H "x-fh-admin-key: $FH_ADMIN_KEY" localhost:8787/api/admin/launch-readiness
```

Technical checks are computed. Contractual, legal and privacy gates cannot be
determined by code and are recorded as attestations:

```bash
curl -X POST -H "x-fh-admin-key: $FH_ADMIN_KEY" -H 'content-type: application/json' \
  -d '{"actor":"ops@fanhour","reason":"Signed copy filed 2026-09-01"}' \
  localhost:8787/api/admin/gates/executed_club_contract/attest
```

Every attestation lands in the immutable `audit_log` with an actor, a reason and
a timestamp.

## Not built, on purpose

Appendix B8's do-not-build list: native app, wallet, redeemable points economy,
POS integration, sponsor/club self-serve dashboards, full fantasy manager,
persistent global leaderboard, daily/weekly streak economy, complex badges,
general marketplace or logistics, broad club IT integrations.

The matchweek status board is the one recognition mechanic that ships. It is
secondary, optional to view, fixture-bounded, alias-only, uses positive bands
instead of a raw rank, and is never linked to a prize.

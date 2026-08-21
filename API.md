# API Contract

For a separately-hosted front end (Lovable, or any other) calling this backend.

Base URL is your server, e.g. `https://api.example.com`. All bodies are JSON.
All user-facing strings come back from the API already in Arabic under
`*_ar` keys — **the front end must render those, never invent its own copy**,
because several of them are legally-reviewed claim and privacy wording.

## Setup

Set the allowlist before the front end can call anything:

```bash
FH_ALLOWED_ORIGINS=https://your-preview.lovable.app,https://your-custom-domain
```

Unlisted origins get no CORS grant and preflights return 403. There is no
wildcard, and credentials are never allowed — the fan session travels in the
`x-fh-session` header, not a cookie.

## Fan session

After `POST /challenge/start`, store `sessionId` and send it as `x-fh-session`
on every later fan call. Use `sessionStorage`, not a cookie and not
`localStorage` — it is not an identity and must not become a cross-device
credential.

---

## Fan endpoints

### `GET /api/challenge/live`
No session needed. Call on landing.

```jsonc
{
  "open": true,
  "demoMode": true,
  "challenge": {
    "id": "chl_…", "title_ar": "تحدي الحزم — الأهلي", "version": 1,
    "closes_at": "2026-08-28 08:10:00",
    "fixture": { "pilot_index": "F1", "opponent_ar": "الأهلي",
                 "home_away": "away", "kickoff_at": "…", "matchweek": "MW1" }
  },
  "offerTeaser": { "sponsor_name_ar": "…", "title_ar": "…" },
  "questionCount": 3
}
```

When `open` is `false` you get `nextFixture` and `message_ar` instead. Render
the next-fixture cue — **do not** invent a challenge to fill the gap.

### `POST /api/challenge/start`
Body `{ "source": "board" }` (optional campaign tag). Returns `sessionId` and
three questions, each with `options[]` of `{ id, text_ar }`.

The correct answer is **never** in this payload. Do not attempt to score
client-side; the server is authoritative.

### `POST /api/challenge/answer`
Body `{ questionId, optionId }`. Returns `{ answered, total }`.

Deliberately does **not** say whether the answer was right — that would leak the
key while the challenge is open. Show progress only. Answers are immutable: a
second submission for the same question returns 409 `ALREADY_ANSWERED`.

### `POST /api/challenge/complete`
No body. Returns the full result:

```jsonc
{ "result": {
  "score": 2, "total": 3, "accuracy": 0.667,
  "feedback_ar": "أداء قوي! قريب جدًا من العلامة الكاملة.",
  "review": [{ "text_ar": "…", "explanation_ar": "…", "wasCorrect": true,
               "chosen": {"text_ar": "…"}, "correct": {"text_ar": "…"} }]
}}
```

### `GET /api/result`
Re-readable. This is what makes an OTP failure non-destructive — the fan can
retry verification without replaying the challenge.

### `GET /api/status`
Optional matchweek board. Anonymous fans may view it; never force verification
to see it.

```jsonc
{ "participants": 96,
  "top": [{ "rank": 1, "alias_ar": "نسر الحزم 4821", "score": 3 }],
  "yourBand": { "key": "strong", "label_ar": "أداء قوي هذه الجولة" },
  "note_ar": "هذه لوحة تقدير للمتعة فقط، ولا علاقة لها بأي جائزة أو مزية." }
```

Render `yourBand` as a positive label. **Never display a raw rank position for
the current fan** — bands only. Always show `note_ar`.

### `GET /api/offer`
Requires a completed challenge. Gated on completion, never on score.

Returns `offer` (with `terms_ar`, `excluded_ar`, `valid_hours_ar`,
`expires_at`, `escalation_contact`), `availability`, and
`independence_note_ar` — display that note prominently, it is what tells the
fan the benefit does not depend on their score.

### `POST /api/claim/intent`
Returns `offerId`, `termsVersion`, `required_ar`, and the four `localities`
with Arabic labels. Render those four exactly; do not add a fifth or ask for
a finer location.

### `POST /api/claim/verify/start`
```jsonc
{ "birthYear": 1995, "locality": "al_rass", "mobile": "0512345678",
  "acceptTerms": true, "offerId": "ofr_…", "resend": false }
```

Returns `{ verificationId, expiresAt, mobileLast2 }`, plus `demoOtp` and
`demoMode: true` when the server runs with `FH_DEMO=1`.

Errors to handle: `TERMS_REQUIRED` 400, `AGE_INELIGIBLE` 403,
`LOCALITY_REQUIRED` 400, `INVALID_MOBILE` 400, `COOLDOWN` / `RESEND_LIMIT` /
`RATE_LIMITED` 429 (with `retryAfter`). Every one carries `message_ar`.

### `POST /api/claim/verify/confirm`
```jsonc
{ "verificationId": "vrf_…", "code": "123456",
  "mobile": "0512345678", "marketingConsent": false }
```

`marketingConsent` must default to **false** and its checkbox must be unchecked
and separate from the terms acceptance. It can never be required to receive the
benefit.

Success returns `{ claim: { id, shortCode, state, expiresAt, offer: {…} } }`.
`alreadyClaimed: true` means the fan already held this claim — show the existing
one, not an error.

On a wrong code you get 400 with `attemptsLeft` and `resultStillAvailable: true`.
Say so in the UI: the result is safe.

Send an `Idempotency-Key` header to make retries safe.

### `GET /api/claim/:id` · `GET /api/history`
The claim, and the fan's verified history plus `nextFixture`.

---

## Merchant endpoints — `/api/merchant`

`POST /login` `{ staffId, pin }` → `{ token, staff, outlet }`. Send
`Authorization: Bearer <token>` afterwards.

`POST /validate` `{ code }` → read-only verdict. Does not redeem.

```jsonc
{ "result": "VALID", "label_ar": "صالحة — سلّم المزية للمشجّع",
  "claim": { "shortCode": "3CK0-T9RB", "state": "ISSUED", "expiresAt": "…" },
  "offer": { "title_ar": "…", "benefit_ar": "…", "excluded_ar": "…" },
  "canConfirm": true }
```

`result` is one of `VALID` · `EXPIRED` · `ALREADY_REDEEMED` ·
`WRONG_OFFER_LOCATION` · `MANUAL_REVIEW` · `NOT_FOUND`. Render each with an
icon **and** the `label_ar` text — never colour alone.

`POST /redeem` `{ code }` → confirms. A second call returns 409
`ALREADY_REDEEMED`; surface that plainly, it is the anti-sharing control working.

`GET /activity` → today's aggregate count for this outlet.

No merchant response ever contains a fan identifier or phone number. If you find
yourself rendering one, something is wrong.

---

## Board endpoint — `GET /api/board?k=<FH_BOARD_KEY>`

Aggregate only. Poll every ~2s.

```jsonc
{ "engagement": { "landings": 34, "starts": 108, "completions": 96,
                  "answers": 300, "resultViews": 96, "completionRate": 0.889 },
  "value": { "verifiedFans": 38, "qassimRelevant": 29, "claims": 38,
             "redemptions": 17,
             "byLocality": { "al_rass": 24, "qassim_other": 5,
                             "ksa_other": 5, "outside_ksa": 4 },
             "verificationRate": 0.396, "claimToRedemption": 0.447 },
  "recent": [{ "name": "redemption_complete", "occurred_at": "…" }] }
```

`recent` event names: `challenge_start` · `challenge_complete` ·
`claim_issued` · `redemption_complete`.

The board key is separate from the admin key on purpose — a screen on a wall
must never carry admin access.

---

## Rules the front end must not break

1. **No identity before value.** Landing, challenge, result and status must work
   with no phone number, no login, no OTP.
2. **The benefit is score-independent.** Never gate the offer on the score, and
   never imply a better score earns more.
3. **Never score client-side.** The server is authoritative; the answer key is
   not in any payload.
4. **Render the API's Arabic strings.** `terms_ar`, `independence_note_ar`,
   `note_ar` and every `message_ar` are reviewed copy.
5. **Marketing consent** — separate, unchecked, never required.
6. **No raw rank** for the current fan; positive bands only.
7. **No fan PII on the merchant or board surfaces.**
8. **Truthful countdowns only**, against real `expires_at` / `closes_at` values.
   No manufactured urgency.

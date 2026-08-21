# Lovable build prompt

Paste the block below as the **initial message** when creating the Lovable
project. It builds the three surfaces as a front end against the existing
FanHour API (see `API.md`), with no backend of its own.

Before you start, set on the API server:

```bash
FH_ALLOWED_ORIGINS=https://<your-preview>.lovable.app
```

Then in Lovable, set `VITE_API_BASE` to your API's public URL.

---

Build an Arabic-first, right-to-left mobile web app called **تحدي الحزم — فان أور**
(FanHour × Al Hazem). It is a football fan engagement pilot for Al Hazem FC in
Al Rass, Qassim, Saudi Arabia.

It is a **front end only**. Do not create a database, do not add Supabase, do not
add auth. All state comes from an existing REST API at `VITE_API_BASE`. Read the
attached API contract and follow it exactly.

## Language and direction

- Every screen is Arabic, `dir="rtl"`, `lang="ar"`.
- Font: `IBM Plex Sans Arabic` from Google Fonts, with a system Arabic fallback.
- Arabic needs generous leading — body `line-height: 1.75`.
- Wrap Latin numerals in a `.num` span with `direction: ltr; unicode-bidi: isolate;`
  and tabular figures, so numbers inside Arabic sentences read correctly.
- Render the Arabic strings the API returns (`*_ar` keys). Do not write your own
  versions of terms, privacy or claim copy — several are legally reviewed.
- Fixture dates use the Gregorian calendar: `ar-SA-u-ca-gregory`. Plain `ar-SA`
  defaults to Hijri and will not match the official league schedule.
- Arabic plurals: use the dual and the 3–10 plural properly. "6 يوم" is wrong;
  after a preposition it is "خلال 6 أيام", and the dual is "يومين", not "يومان".

## Visual design

Follow Al Hazem's colours — white and blue — not a generic SaaS palette.

```
--blue-900 #0B2A4A   --blue-700 #10508C   --blue-600 #1565B0
--blue-100 #E3EEF8   --blue-050 #F2F7FC
--ink #12212F  --ink-2 #43596E  --ink-3 #6B8199
--line #DCE5EE  --bg #FFFFFF  --bg-2 #F6F9FC
--ok #0E7A4A / #E6F5ED    --warn #9A5B00 / #FDF1DF    --err #B3261E / #FCEBEA
```

Light theme. Calm and confident, not gamified — no confetti, no XP bars, no coin
or trophy iconography. The fan flow is a max-520px column centred on desktop.

Accessibility is not optional here:
- 44×44px minimum touch targets.
- **State is never conveyed by colour alone** — every status carries an icon and
  a written Arabic label.
- Visible focus rings.
- Respect `prefers-reduced-motion`.

## Three routes

### `/` — the fan journey

Strict order. The first four steps must work with **no phone number, no login,
no OTP** — that ordering is the product's central rule.

1. **Landing** — `GET /api/challenge/live`. The club and the fixture lead. The
   sponsor benefit is one quiet line at the bottom, never the hero. If `open` is
   false, show the next-fixture cue; never invent a filler challenge.
2. **Challenge** — `POST /api/challenge/start`, then one question per screen with
   visible 1/3, 2/3, 3/3 progress. One primary action per screen. No per-question
   countdown. Tell the fan an answer is final before they commit. The response
   never reveals correctness — show progress only.
3. **Result** — score, accuracy, the API's `feedback_ar`, and a review of all
   three answers with explanations. Never shame a wrong answer. Below it, a
   collapsed optional link to the matchweek board (`GET /api/status`): show
   `yourBand` as a positive label, never a raw rank for this fan, and always show
   `note_ar` stating it is unrelated to any prize.
4. **Offer** — `GET /api/offer`. Show `independence_note_ar` prominently: the
   benefit does not depend on the score. Material terms, exclusions and hours
   visible before the fan commits, with no hidden scroll.
5. **Claim gate** — only now collect four things: birth year (year only), a
   coarse home area from the four options the API returns, a Saudi mobile, and an
   explicit acceptance checkbox. Never ask for GPS, postcode, full address,
   national ID or a name. Say plainly why each is needed.
6. **OTP** — `POST /api/claim/verify/confirm`. If the code is wrong, state
   clearly that the result is safe and can be retried without replaying the
   challenge. Resend button with a 60s cooldown. A separate, **unchecked**
   marketing-reminder checkbox that is never required for the benefit. If the
   API returns `demoOtp`, show it in an obviously temporary hatched "demo" box —
   it must never look like a product feature.
7. **Claim** — QR of the `shortCode` (use the `qrcode` package) plus the short
   code in large text as a typed fallback, expiry countdown, terms, and the
   sponsor's escalation contact. State that the sponsor funds and fulfils the
   benefit and FanHour only verifies it.
8. **History** — verified results, claims, and the next fixture as the return
   cue.

### `/merchant` — outlet staff validator

Plain and fast, used on a staff phone under shop lighting. Login by staff ID and
PIN. One input for the code, one **افحص الرمز** button, a clear verdict, then a
separate **أكّد الاستخدام** button. Accept lower-case and pasted whitespace.

Render each of the six verdicts with an icon and its `label_ar`. When a code is
presented twice, `ALREADY_REDEEMED` must read as a normal, expected outcome —
that is the anti-sharing control working, not an error state.

Never render a fan phone number or identifier. Nothing in the API gives you one.

### `/board` — live value board for a projector

The pitch surface. Dark ground (`#0B2A4A` gradient), sized in `clamp()`/`vw` so
it reads from the back of a room. Polls `GET /api/board?k=…` every 2 seconds.

Three beats, laid out right-to-left in RTL:

- **Right — التفاعل موجود**: completions as a huge number, with starts and
  answers beneath, plus the completion rate.
- **Middle — the question**: `لكن كيف يتحول إلى قيمة؟` set large, with an arrow
  pointing left toward the value panel, and a QR below it linking to `/?src=board`
  captioned `امسح وشارك الآن` so the audience joins from their own phones.
- **Left — القيمة**: confirmed merchant redemptions as a huge accent number, then
  verified fans and issued claims, then `من الرس والقصيم` with a stacked
  locality bar.

Add a live ticker of recent events along the bottom, a "مباشر" pulse indicator,
and a footer line: `جميع الأرقام تجميعية. لا تظهر هنا أي بيانات شخصية لأي مشجّع.`

Counts should animate upward when they change, so movement is visible from a
distance. Below 900px wide, the three beats stack instead of squeezing.

## Do not build

Explicitly out of scope, and adding any of them breaks the pilot's rules: native
app wrapper, wallet, points or coin economy, POS integration, club or sponsor
self-serve dashboards, fantasy manager, persistent global leaderboard, daily or
weekly streaks, badge collections, marketplace, push notifications, comments,
open voting, or any social feed.

The matchweek board is the only recognition mechanic — secondary, optional,
fixture-bounded, alias-only, never prize-linked.

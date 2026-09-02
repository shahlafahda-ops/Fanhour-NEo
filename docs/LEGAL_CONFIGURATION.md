# Legal Configuration

> FanHour does not invent legal conclusions. Where final wording or an approval
> is missing, the product surfaces a visible blocker rather than guessing.

## Campaign operating modes
- **engagement_only** — no prize, no commercial benefit.
- **participation_benefit** — sponsor-funded benefit, independent of prediction
  accuracy. Default for Pilot 1 sponsor activations.

Any legal or regulatory review of a campaign (prize rules, raffle
regulations, sponsor terms) happens outside FanHour, before the campaign is
ever entered into the system. The product does not track an approval status,
gate activation on one, or infer any legal conclusion of its own — that
review is handled by FanHour's own legal counsel, not by this codebase.

## Benefit rules (Pilot 1)
- Benefits are **additive**, framed as "منفعة جمهور الحزم / ميزة من الشريك" —
  never jackpot/casino language.
- Eligibility requires qualified participation in the campaign's **linked
  fixture** (`fixture_participation`), not "any participation".
- Standard benefit does **not** depend on predicting correctly.
- Age gate (default 18+) and optional locality restriction are configurable per
  campaign. Reveal timing defaults to `post_result`.

## Consent
Required acceptance (benefit terms + privacy) and optional marketing consent are
**separate**; marketing is never pre-selected and is withdrawable. Each consent
row stores type, policy version, timestamp, source, and granted/withdrawn state.

## Approved copy is a launch blocker
`/privacy`, `/terms`, and `/campaign-rules/[slug]` render a visible
`REQUIRES_APPROVED_LEGAL_COPY` marker until the approved Arabic text is supplied
and versioned (`PRIVACY_POLICY_VERSION`, `TERMS_VERSION`). Do not claim Ministry
approval, regulatory exemption, or club/sponsor rights unless configured and
documented.

## Privacy copy accuracy
Before phone capture the UI states: "لا نطلب منك اسمًا أو رقم جوال لتسجيل
توقعك." We never claim "we collect no personal data" — an anonymous identifier
and (later) a phone may be stored.

# Pilot 1 Human Feedback Loop

Quantitative analytics alone cannot explain *why* supporters return, disappear,
claim a sponsor benefit or ignore it. This is an operational Pilot 1 process,
not a consumer-facing feature.

## Cohorts to recruit (target 10 each)

| Cohort | Behavioural definition | How Ops identifies it |
|---|---|---|
| Retained / highly engaged | `POWER_FAN`, or `ENGAGED` with QMP ≥ 4 | Lifecycle panel on `/ops` |
| One-and-done | Exactly one QMP and ≥ 2 missed closed fixtures since | `AT_RISK` / QMP-1 minus QMP-2 |
| Redeemed the benefit | A claim reached `redeemed` | Commercial funnel |
| Eligible or claimed, never redeemed | Benefit issued, claim still `issued` at expiry | Issued − redeemed |

Where a cohort is too small, use smaller balanced groups rather than delaying
research. Recruit through the same consented channel used for benefit
messaging; never contact a supporter who withheld marketing consent.

## Interview questions

1. When did FanHour first make sense to you?
2. What made you participate the first time?
3. What made you return — or why did you not return?
4. Was making the prediction itself enjoyable?
5. Did seeing your accuracy, streak or rank matter?
6. Did seeing what other Al Hazem supporters predicted matter?
7. How important was the sponsor benefit?
8. If the sponsor benefit disappeared for one fixture, would you still participate?
9. Was claiming or redeeming the benefit easy?
10. What would make FanHour worth using every Al Hazem fixture?

For retained supporters, additionally ask what they consider their personal
FanHour **"Aha moment."**

## Analysis

Cross-reference every answer against the supporter's actual behaviour (QMP,
streak depth, rank, claim/redemption state). The question the pilot must answer
is which force actually drives return:

prediction · football competence · rank/status · community comparison · streak ·
club attachment · sponsor value — or a combination.

## Privacy

- Recruit using the minimum contact data already held under consent.
- Never create new profile fields for research.
- Research notes are stored outside the product database and carry a supporter
  reference, never a phone number.
- An authorised Ops export may list cohort membership by supporter reference
  only; it must not include phone numbers (see `docs/ANALYTICS.md`).

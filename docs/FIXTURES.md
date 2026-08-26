# Loading Fixtures

Two ways to add Al Hazem fixtures:

1. **Ops portal (preferred for day-to-day):** `/ops` → **المباريات** → fill the form
   → **حفظ**. Also where you set the real kickoff time and enter final scores.
2. **Bulk SQL (for loading a whole season at once):** paste into the Supabase
   **SQL Editor** and Run. The reference block below loads the 2026/27 Roshn
   Saudi League schedule.

## How the timing works
For each fixture you provide `kickoff_at`; the app derives the rest:
- **Prediction opens** 3 days before kickoff (`kickoff_at - interval '3 days'`).
- **Prediction cutoff** 5 minutes before kickoff (`kickoff_at - interval '5 minutes'`).
- The fan landing page automatically shows the **soonest upcoming** fixture, and
  flips to the **post-match result** screen once a score is entered.

All times are stored in UTC (`timestamptz`) but written in Riyadh time using the
`+03` offset, and displayed to supporters in `Asia/Riyadh`.

> ⚠️ **Kickoff times below are 20:00 Riyadh placeholders.** Dates and matchups
> are confirmed; update each match's exact kickoff in `/ops` as SPL confirms it,
> before that match's prediction window opens.

## Reference: Roshn Saudi League 2026/27, rounds 4–18

```sql
-- Remove the demo match (and any predictions on it) so it doesn't mix in.
delete from prediction where fixture_id in (select id from fixture where slug = 'demo-1');
delete from fixture where slug = 'demo-1';

-- Al Hazem — Roshn Saudi League 2026/27, rounds 4–18.
-- Kickoff times are 20:00 Riyadh PLACEHOLDERS — adjust per match in /ops.
insert into fixture (club_id, slug, opponent_ar, competition_ar, hazem_side,
  kickoff_at, prediction_open_at, cutoff_at, status)
select c.id, v.slug, v.opponent_ar, 'دوري روشن السعودي', v.hazem_side::home_away,
       v.kickoff, v.kickoff - interval '3 days', v.kickoff - interval '5 minutes', 'open'
from club c
cross join (values
  ('rsl-r04-al-shabab','الشباب','home',  timestamptz '2026-08-30 20:00:00+03'),
  ('rsl-r05-al-faisaly','الفيصلي','away', timestamptz '2026-09-05 20:00:00+03'),
  ('rsl-r06-al-taawoun','التعاون','home', timestamptz '2026-09-08 20:00:00+03'),
  ('rsl-r07-al-ahli','الأهلي','away',     timestamptz '2026-09-10 20:00:00+03'),
  ('rsl-r08-neom','نيوم','home',          timestamptz '2026-09-17 20:00:00+03'),
  ('rsl-r09-al-fateh','الفتح','home',     timestamptz '2026-10-09 20:00:00+03'),
  ('rsl-r10-al-hilal','الهلال','away',    timestamptz '2026-10-15 20:00:00+03'),
  ('rsl-r11-al-fayha','الفيحاء','home',   timestamptz '2026-10-22 20:00:00+03'),
  ('rsl-r12-al-khaleej','الخليج','away',  timestamptz '2026-10-29 20:00:00+03'),
  ('rsl-r13-al-nassr','النصر','home',     timestamptz '2026-11-05 20:00:00+03'),
  ('rsl-r14-al-riyadh','الرياض','away',   timestamptz '2026-11-20 20:00:00+03'),
  ('rsl-r15-al-ettifaq','الاتفاق','away', timestamptz '2026-11-26 20:00:00+03'),
  ('rsl-r16-al-qadsiah','القادسية','home',timestamptz '2026-12-03 20:00:00+03'),
  ('rsl-r17-al-kholood','الخلود','away',  timestamptz '2026-12-10 20:00:00+03'),
  ('rsl-r18-abha','أبها','home',          timestamptz '2026-12-14 20:00:00+03')
) as v(slug, opponent_ar, hazem_side, kickoff)
where c.slug = 'alhazem';
```

## Verify what's loaded

```sql
select to_char(kickoff_at at time zone 'Asia/Riyadh','YYYY-MM-DD HH24:MI') as riyadh_time,
       hazem_side, opponent_ar, status
from fixture
order by kickoff_at;
```

## Adding later rounds (19+)
Copy the `insert ... cross join (values ...)` block, replace the value rows with
the new fixtures (unique `slug`, opponent in Arabic, `home`/`away` from Al Hazem's
perspective, and the Riyadh kickoff). Slugs must be unique, so keep the
`rsl-rNN-...` naming.

## Fixing a wrong time or matchup
Prefer `/ops` → **المباريات**. Or by SQL, e.g. set a real kickoff:

```sql
update fixture
set kickoff_at        = timestamptz '2026-08-30 18:15:00+03',
    prediction_open_at = timestamptz '2026-08-30 18:15:00+03' - interval '3 days',
    cutoff_at          = timestamptz '2026-08-30 18:15:00+03' - interval '5 minutes'
where slug = 'rsl-r04-al-shabab';
```

## Notes
- Opponent names are the club's Arabic name only (no "ضد"/"vs"); the UI renders
  the "الحزم × <opponent>" layout itself.
- `competition_ar` is free text shown under the matchup — keep it consistent
  (e.g. `دوري روشن السعودي`).
- Never insert fixtures with `is_test = true` into production data — the default
  is `false`, which is correct here.

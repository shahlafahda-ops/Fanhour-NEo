-- =====================================================================
-- DEVELOPMENT SEED — TEST DATA ONLY. DO NOT RUN IN PRODUCTION.
--
-- Every row is flagged is_test = true and uses OBVIOUSLY fictional names so it
-- can never be mistaken for a signed FanHour partner or a real fixture
-- (prompt §45, §77). Load with: npm run seed  (which refuses when
-- NEXT_PUBLIC_APP_ENV=production or ALLOW_TEST_DATA=false).
-- =====================================================================

do $$
begin
  if not exists (select 1 from club where slug = 'alhazem') then
    insert into club (slug, name_ar, name_en) values ('alhazem', 'الحزم', 'Al Hazem FC');
  end if;
end $$;

-- TEST FIXTURE — DO NOT USE IN PRODUCTION (open now, kickoff in 2h)
insert into fixture (club_id, slug, opponent_ar, competition_ar, hazem_side,
  kickoff_at, prediction_open_at, cutoff_at, status, is_test)
select id, 'test-open-fixture', '[تجريبي] فريق الاختبار', '[تجريبي] دوري الاختبار', 'home',
  now() + interval '2 hour', now() - interval '1 hour', now() + interval '115 minutes', 'open', true
from club where slug = 'alhazem'
on conflict (slug) do nothing;

-- TEST FIXTURE — resolved, for the post-match screen
insert into fixture (club_id, slug, opponent_ar, competition_ar, hazem_side,
  kickoff_at, prediction_open_at, cutoff_at, status, hazem_score, opponent_score, result, is_test)
select id, 'test-resolved-fixture', '[تجريبي] الخصم السابق', '[تجريبي] دوري الاختبار', 'away',
  now() - interval '3 day', now() - interval '6 day', now() - interval '3 day' - interval '5 min',
  'resolved', 2, 1, 'hazem_win', true
from club where slug = 'alhazem'
on conflict (slug) do nothing;

-- TEST SPONSOR + CAMPAIGN (participation_benefit, tied to the open fixture)
insert into sponsor (id, name_ar, commercial_type)
values ('aaaaaaaa-0000-0000-0000-000000000001', '[تجريبي] مقهى الاختبار', 'complimentary')
on conflict (id) do nothing;

insert into campaign (slug, sponsor_id, fixture_id, title_ar, benefit_ar, terms_ar,
  compliance_mode, reveal_timing, min_age, issue_cap, expires_at, is_active, is_test)
select 'test-benefit', 'aaaaaaaa-0000-0000-0000-000000000001', f.id,
  '[تجريبي] منفعة المقهى', 'مشروب مجاني للمشاركين', 'شروط تجريبية — للاختبار فقط.',
  'participation_benefit', 'post_result', 18, 100, now() + interval '30 day', true, true
from fixture f where f.slug = 'test-open-fixture'
on conflict (slug) do nothing;

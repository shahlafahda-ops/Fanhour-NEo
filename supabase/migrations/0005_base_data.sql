-- =====================================================================
-- FanHour — Base (non-test) production data.
-- Contains ONLY the fixed pilot club and feature-flag defaults. It does NOT
-- contain fixtures, sponsors, or fabricated participation — those are entered
-- through the ops portal against real operational data (prompt §45).
-- =====================================================================

insert into club (slug, name_ar, name_en)
values ('alhazem', 'الحزم', 'Al Hazem FC')
on conflict (slug) do nothing;

-- Feature-flag defaults (prompt §49).
insert into feature_flag (key, enabled, value) values
  ('community_feedback', true, null),
  ('optional_depth', true, null),
  ('registration_timing', true, '{"mode":"deferred"}'::jsonb),
  ('rich_profile', true, null),
  ('personal_best', true, null),
  ('benefit_enabled', true, null),
  ('benefit_framing', true, '{"style":"additive"}'::jsonb),
  ('benefit_reveal_timing', true, '{"default":"post_result"}'::jsonb),
  ('notification_timing', false, null),
  ('cohort_status', false, null),
  ('matchweek_status', false, null)
on conflict (key) do nothing;

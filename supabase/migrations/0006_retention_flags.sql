-- =====================================================================
-- FanHour — Pilot 1 retention / status / commentary layer.
--
-- NO SCHEMA CHANGE IS REQUIRED for this layer: XP, rank, fixture streak,
-- lifecycle state, exact-score correctness and commentary reactions are all
-- DERIVED at read time from the authoritative `prediction` + `fixture` rows.
-- Persisting them would create a second source of truth that silently diverges
-- when ops corrects a score or when an anonymous session merges into a
-- supporter (see docs/DATA_MODEL.md).
--
-- This migration only registers the two new feature flags.
-- =====================================================================

insert into feature_flag (key, enabled, value) values
  -- Football-commentary microcopy. Expression only: never affects XP, rank or
  -- sponsor-benefit eligibility.
  ('commentary_reactions', true, null),
  -- Deferred to P1: no post-match poll surface exists in Pilot 1 P0.
  ('post_match_poll', false, null)
on conflict (key) do nothing;

-- =====================================================================
-- FanHour — Core schema (Al Hazem Pilot 1)
-- Domain boundaries (prompt §53, §66):
--   identity/contact  |  behavioural activity  |  commercial fulfilment
-- All timestamps are timestamptz; business logic uses Asia/Riyadh.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type fixture_status as enum ('scheduled','open','locked','resolved','cancelled');
create type home_away       as enum ('home','away');
create type prediction_outcome as enum ('hazem_win','draw','opponent_win');
create type fixture_result  as enum ('hazem_win','draw','opponent_win');
create type claim_status    as enum ('issued','redeemed','expired','void');
create type compliance_mode as enum ('engagement_only','participation_benefit','regulated_prize');
create type legal_approval_status as enum ('not_required','pending','approved','rejected');
create type benefit_reveal_timing as enum ('post_submission','post_result');
create type campaign_eligibility_mode as enum ('fixture_participation','any_participation');
create type ops_role        as enum ('super_admin','ops','analyst','support');
create type locality_segment as enum ('al_rass','rest_of_qassim','other_ksa','outside_ksa','unknown');
create type consent_type     as enum ('benefit_terms','privacy','marketing');

-- ---------- Club (only Al Hazem in Pilot 1) ----------
create table club (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ar text not null,
  name_en text not null,
  crest_url text,
  created_at timestamptz not null default now()
);

-- ---------- Fixtures ----------
create table fixture (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  slug text unique not null,
  opponent_ar text not null,
  opponent_en text,
  competition_ar text not null,
  hazem_side home_away not null,
  venue_ar text,
  kickoff_at timestamptz not null,
  prediction_open_at timestamptz not null,
  cutoff_at timestamptz not null,
  status fixture_status not null default 'scheduled',
  hazem_score int check (hazem_score is null or hazem_score >= 0),
  opponent_score int check (opponent_score is null or opponent_score >= 0),
  result fixture_result,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Window integrity: open <= cutoff <= kickoff.
  constraint fixture_window_valid check (prediction_open_at <= cutoff_at and cutoff_at <= kickoff_at),
  -- A resolved fixture must carry both scores and a result.
  constraint fixture_resolved_has_scores check (
    status <> 'resolved' or (hazem_score is not null and opponent_score is not null and result is not null)
  )
);
create index fixture_status_idx on fixture(status);
create index fixture_kickoff_idx on fixture(kickoff_at);

-- ---------- Identity: anonymous session -> supporter ----------
-- Anonymous first-party session. NOT device fingerprinting.
create table anonymous_session (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid, -- set on merge/verification
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Verified/persistent supporter. Carries NO contact PII itself.
create table supporter (
  id uuid primary key default gen_random_uuid(),
  is_verified boolean not null default false,
  age_meets_requirement boolean, -- null = unknown/not asked
  locality locality_segment not null default 'unknown',
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
alter table anonymous_session
  add constraint anon_supporter_fk foreign key (supporter_id) references supporter(id);

-- Restricted PII table (identity/contact). Access tightly controlled.
create table supporter_contact (
  supporter_id uuid primary key references supporter(id) on delete cascade,
  phone_e164 text not null,
  phone_lookup_hash text not null unique, -- peppered hash for dedupe without exposing PII
  verified_at timestamptz not null default now()
);

-- ---------- Consent ----------
create table consent (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid references supporter(id) on delete cascade,
  anonymous_session_id uuid references anonymous_session(id),
  type consent_type not null,
  policy_version text not null,
  granted boolean not null,
  source text,
  created_at timestamptz not null default now(),
  constraint consent_subject_present check (supporter_id is not null or anonymous_session_id is not null)
);
create index consent_supporter_idx on consent(supporter_id);

-- ---------- Predictions ----------
-- One authoritative qualified prediction per identity per fixture.
create table prediction (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixture(id),
  supporter_id uuid references supporter(id),
  anonymous_session_id uuid references anonymous_session(id),
  outcome prediction_outcome not null,
  exact_hazem_score int check (exact_hazem_score is null or exact_hazem_score >= 0),
  exact_opponent_score int check (exact_opponent_score is null or exact_opponent_score >= 0),
  is_correct boolean, -- graded at resolution
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prediction_identity_present check (supporter_id is not null or anonymous_session_id is not null)
);
-- Exactly one qualified prediction per fixture per identity (whichever id is set).
create unique index prediction_one_per_supporter_fixture
  on prediction(fixture_id, supporter_id) where supporter_id is not null;
create unique index prediction_one_per_anon_fixture
  on prediction(fixture_id, anonymous_session_id) where anonymous_session_id is not null;
create index prediction_fixture_idx on prediction(fixture_id);

-- Optional audit of prediction edits (does not affect QMP).
create table prediction_change (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references prediction(id) on delete cascade,
  outcome prediction_outcome not null,
  created_at timestamptz not null default now()
);

comment on table prediction is
  'Qualified core prediction. QMP counts DISTINCT fixtures here, never edits.';

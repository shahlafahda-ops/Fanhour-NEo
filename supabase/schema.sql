-- =====================================================================
-- FanHour — FULL SCHEMA (paste once into the Supabase SQL Editor).
-- Concatenation of supabase/migrations/0001..0012 in order.
-- Supabase already provides the auth schema and auth.uid(), so no stub
-- is needed here. Safe to run once on a fresh project.
-- =====================================================================

-- >>> supabase/migrations/0001_core_schema.sql
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

-- >>> supabase/migrations/0002_commercial_schema.sql
-- =====================================================================
-- FanHour — Commercial fulfilment schema (sponsors, campaigns, merchants,
-- claims) + operations (roles) + analytics + support + audit + flags.
-- =====================================================================

-- ---------- Sponsors & campaigns ----------
create table sponsor (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  logo_url text,
  -- Commercial integrity (prompt §83): never treat a free partner as paid.
  commercial_type text not null default 'paid'
    check (commercial_type in ('paid','complimentary','subsidized','merchant_only')),
  created_at timestamptz not null default now()
);

create table campaign (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  sponsor_id uuid not null references sponsor(id),
  fixture_id uuid references fixture(id),
  title_ar text not null,
  benefit_ar text,
  description_ar text,
  terms_ar text,
  eligibility_mode campaign_eligibility_mode not null default 'fixture_participation',
  reveal_timing benefit_reveal_timing not null default 'post_result',
  compliance_mode compliance_mode not null default 'engagement_only',
  legal_approval_status legal_approval_status not null default 'not_required',
  legal_reference text,
  approved_at timestamptz,
  approved_by uuid,
  min_age int not null default 18,
  allowed_localities locality_segment[] not null default '{}',
  issue_cap int check (issue_cap is null or issue_cap >= 0),
  issued_count int not null default 0 check (issued_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default false,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cap integrity.
  constraint campaign_issued_within_cap check (issue_cap is null or issued_count <= issue_cap),
  -- Regulated prize may never be active without approval (prompt §26).
  constraint campaign_regulated_requires_approval check (
    not (is_active and compliance_mode = 'regulated_prize' and legal_approval_status <> 'approved')
  ),
  -- A benefit-bearing active campaign must be tied to a fixture.
  constraint campaign_active_needs_fixture check (
    not (is_active and compliance_mode <> 'engagement_only' and fixture_id is null)
  )
);
create index campaign_fixture_idx on campaign(fixture_id);
create index campaign_active_idx on campaign(is_active);

-- ---------- Merchants ----------
create table merchant (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table merchant_location (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchant(id) on delete cascade,
  name_ar text not null,
  locality locality_segment not null default 'al_rass',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Merchant staff accounts map to a Supabase auth user, scoped to a merchant.
create table merchant_user (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  merchant_id uuid not null references merchant(id) on delete cascade,
  merchant_location_id uuid references merchant_location(id),
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index merchant_user_auth_idx on merchant_user(auth_user_id);

-- Which campaigns a merchant may validate (scoping — prompt §52, §75).
create table campaign_merchant (
  campaign_id uuid not null references campaign(id) on delete cascade,
  merchant_id uuid not null references merchant(id) on delete cascade,
  primary key (campaign_id, merchant_id)
);

-- ---------- Operations accounts ----------
create table ops_user (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  role ops_role not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index ops_user_auth_idx on ops_user(auth_user_id);

-- ---------- Claims (commercial fulfilment) ----------
create table claim (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign(id),
  fixture_id uuid not null references fixture(id),
  supporter_id uuid not null references supporter(id),
  status claim_status not null default 'issued',
  token_hash text not null unique,      -- hash of opaque 192-bit token
  fallback_code text not null unique,   -- human-friendly, high-entropy
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_merchant_id uuid references merchant(id),
  redeemed_location_id uuid references merchant_location(id),
  redeemed_by uuid, -- merchant_user.id
  is_test boolean not null default false,
  -- One benefit claim per supporter per campaign (prompt §67).
  unique (campaign_id, supporter_id)
);
create index claim_campaign_idx on claim(campaign_id);
create index claim_supporter_idx on claim(supporter_id);
create index claim_status_idx on claim(status);

create table redemption_log (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claim(id),
  merchant_id uuid,
  merchant_location_id uuid,
  operator_id uuid,
  campaign_id uuid,
  previous_status claim_status,
  resulting_status claim_status,
  outcome text not null,
  created_at timestamptz not null default now()
);

-- ---------- Analytics events ----------
create table event (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  anonymous_session_id uuid,
  supporter_id uuid,
  fixture_id uuid,
  campaign_id uuid,
  sponsor_id uuid,
  merchant_id uuid,
  merchant_location_id uuid,
  props jsonb not null default '{}',
  source text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index event_name_idx on event(name);
create index event_created_idx on event(created_at);
create index event_fixture_idx on event(fixture_id);

-- ---------- Support ----------
create table support_ticket (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claim(id),
  campaign_id uuid references campaign(id),
  merchant_id uuid references merchant(id),
  failure_type text,
  note text,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

-- ---------- Feature flags ----------
create table feature_flag (
  key text primary key,
  enabled boolean not null default false,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Audit log (append-only) ----------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  object_type text not null,
  object_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_object_idx on audit_log(object_type, object_id);

-- ---------- Club distribution touchpoints (prompt §82) ----------
create table distribution_touchpoint (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixture(id),
  channel text not null,
  status text not null default 'scheduled' check (status in ('contracted','scheduled','delivered')),
  source_tag text,
  created_at timestamptz not null default now()
);

-- >>> supabase/migrations/0003_otp_and_functions.sql
-- =====================================================================
-- FanHour — OTP challenges + concurrency-safe server functions.
-- =====================================================================

-- ---------- OTP challenges ----------
-- Stores only the HASH of the code; raw OTP never persisted or logged.
create table otp_challenge (
  id uuid primary key default gen_random_uuid(),
  phone_lookup_hash text not null,      -- peppered; not the raw number
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed boolean not null default false,
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index otp_challenge_lookup_idx on otp_challenge(phone_lookup_hash, created_at desc);

-- Rate-limit ledger for sensitive endpoints (OTP request, fallback claim, etc.).
create table rate_limit (
  bucket text not null,       -- e.g. 'otp_request:<hash>' or 'redeem_lookup:<ip>'
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);

-- Atomic fixed-window increment; returns the running count for the window.
create or replace function increment_rate_limit(p_bucket text, p_window_start timestamptz)
returns table(count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into rate_limit(bucket, window_start, count)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
  do update set count = rate_limit.count + 1
  returning rate_limit.count into count;
  return next;
end;
$$;

-- =====================================================================
-- issue_claim_atomic: atomically respects the campaign issue cap.
-- Prevents the "count then insert" race (prompt §31, §72) by taking a row
-- lock on the campaign and incrementing issued_count in the same transaction.
-- Returns the new claim id, or raises 'cap_reached' / 'campaign_inactive'.
-- =====================================================================
create or replace function issue_claim_atomic(
  p_campaign_id uuid,
  p_fixture_id uuid,
  p_supporter_id uuid,
  p_token_hash text,
  p_fallback_code text,
  p_expires_at timestamptz,
  p_is_test boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap int;
  v_issued int;
  v_active boolean;
  v_claim_id uuid;
begin
  -- Lock the campaign row for the duration of the transaction.
  select issue_cap, issued_count, is_active
    into v_cap, v_issued, v_active
    from campaign where id = p_campaign_id for update;

  if not found or not v_active then
    raise exception 'campaign_inactive';
  end if;

  if v_cap is not null and v_issued >= v_cap then
    raise exception 'cap_reached';
  end if;

  insert into claim (campaign_id, fixture_id, supporter_id, token_hash, fallback_code, expires_at, is_test)
  values (p_campaign_id, p_fixture_id, p_supporter_id, p_token_hash, p_fallback_code, p_expires_at, p_is_test)
  returning id into v_claim_id;

  update campaign set issued_count = issued_count + 1, updated_at = now()
    where id = p_campaign_id;

  return v_claim_id;
end;
$$;

-- =====================================================================
-- redeem_claim_atomic: single-use, concurrency-safe redemption
-- (prompt §30, §71). The UPDATE ... WHERE status='issued' flips exactly one
-- row; a simultaneous second call finds status<>'issued' and returns the
-- already-terminal outcome. Records a redemption_log row either way.
-- =====================================================================
create or replace function redeem_claim_atomic(
  p_claim_id uuid,
  p_merchant_id uuid,
  p_location_id uuid,
  p_operator_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev claim_status;
  v_campaign_id uuid;
  v_expires timestamptz;
  v_campaign_active boolean;
  v_updated int;
  v_outcome text;
begin
  select status, campaign_id, expires_at into v_prev, v_campaign_id, v_expires
    from claim where id = p_claim_id for update;

  if not found then
    return 'not_found';
  end if;

  select is_active into v_campaign_active from campaign where id = v_campaign_id;
  if not coalesce(v_campaign_active, false) then
    insert into redemption_log(claim_id, merchant_id, merchant_location_id, operator_id, campaign_id, previous_status, resulting_status, outcome)
    values (p_claim_id, p_merchant_id, p_location_id, p_operator_id, v_campaign_id, v_prev, v_prev, 'campaign_paused');
    return 'campaign_paused';
  end if;

  if v_prev = 'redeemed' then
    v_outcome := 'already_redeemed';
  elsif v_prev = 'void' then
    v_outcome := 'void';
  elsif v_prev = 'expired' or (v_expires is not null and now() > v_expires) then
    v_outcome := 'expired';
  elsif v_prev = 'issued' then
    update claim
      set status = 'redeemed', redeemed_at = now(),
          redeemed_merchant_id = p_merchant_id,
          redeemed_location_id = p_location_id,
          redeemed_by = p_operator_id
      where id = p_claim_id and status = 'issued';
    get diagnostics v_updated = row_count;
    v_outcome := case when v_updated = 1 then 'redeemed' else 'already_redeemed' end;
  else
    v_outcome := 'not_found';
  end if;

  insert into redemption_log(claim_id, merchant_id, merchant_location_id, operator_id, campaign_id, previous_status, resulting_status, outcome)
  values (p_claim_id, p_merchant_id, p_location_id, p_operator_id, v_campaign_id,
          v_prev, case when v_outcome = 'redeemed' then 'redeemed' else v_prev end, v_outcome);

  return v_outcome;
end;
$$;

-- =====================================================================
-- resolve_fixture_atomic: idempotently resolve a fixture and grade all its
-- predictions (prompt §34). Safe to call more than once.
-- =====================================================================
create or replace function resolve_fixture_atomic(
  p_fixture_id uuid,
  p_hazem_score int,
  p_opponent_score int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result fixture_result;
begin
  if p_hazem_score < 0 or p_opponent_score < 0 then
    raise exception 'invalid_scores';
  end if;
  v_result := case
    when p_hazem_score > p_opponent_score then 'hazem_win'::fixture_result
    when p_hazem_score < p_opponent_score then 'opponent_win'::fixture_result
    else 'draw'::fixture_result end;

  update fixture
    set hazem_score = p_hazem_score, opponent_score = p_opponent_score,
        result = v_result, status = 'resolved', updated_at = now()
    where id = p_fixture_id;

  update prediction
    set is_correct = (outcome::text = v_result::text), updated_at = now()
    where fixture_id = p_fixture_id;
end;
$$;

-- >>> supabase/migrations/0004_rls.sql
-- =====================================================================
-- FanHour — Row Level Security.
--
-- Model:
--  * Fan-facing writes (predictions, claims, consent, OTP) go through SERVER
--    API routes using the service role, which bypasses RLS. The browser only
--    ever holds the anon key.
--  * With RLS enabled and NO permissive policy, the anon/authenticated roles
--    get zero access — this is the intended default-deny for every sensitive
--    table (prompt §51, §52).
--  * Public read is granted ONLY for non-sensitive fixture/club/sponsor data.
--  * Ops and merchant portals authenticate via Supabase Auth; policies below
--    scope their access by ops_user / merchant_user membership.
-- =====================================================================

-- Helper: is the current auth user an active ops user (optionally of a role)?
create or replace function is_ops(min_roles ops_role[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ops_user o
    where o.auth_user_id = auth.uid() and o.is_active
      and (min_roles is null or o.role = any(min_roles))
  );
$$;

-- Helper: does the current merchant user have access to a given campaign?
create or replace function merchant_can_access_campaign(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from merchant_user mu
    join campaign_merchant cm on cm.merchant_id = mu.merchant_id
    where mu.auth_user_id = auth.uid() and mu.is_active and cm.campaign_id = p_campaign_id
  );
$$;

-- Enable RLS everywhere.
alter table club enable row level security;
alter table fixture enable row level security;
alter table anonymous_session enable row level security;
alter table supporter enable row level security;
alter table supporter_contact enable row level security;
alter table consent enable row level security;
alter table prediction enable row level security;
alter table prediction_change enable row level security;
alter table sponsor enable row level security;
alter table campaign enable row level security;
alter table merchant enable row level security;
alter table merchant_location enable row level security;
alter table merchant_user enable row level security;
alter table campaign_merchant enable row level security;
alter table ops_user enable row level security;
alter table claim enable row level security;
alter table redemption_log enable row level security;
alter table event enable row level security;
alter table support_ticket enable row level security;
alter table feature_flag enable row level security;
alter table audit_log enable row level security;
alter table distribution_touchpoint enable row level security;
alter table otp_challenge enable row level security;
alter table rate_limit enable row level security;

-- ---------- Public read (non-sensitive) ----------
create policy club_public_read on club for select using (true);
create policy fixture_public_read on fixture for select using (true);
create policy sponsor_public_read on sponsor for select using (true);
-- Only active, non-test campaigns are publicly readable.
create policy campaign_public_read on campaign for select using (is_active and not is_test);
-- Feature flags are readable so the client can render flagged UI.
create policy flag_public_read on feature_flag for select using (true);

-- ---------- Ops portal ----------
create policy ops_read_fixture on fixture for select using (is_ops());
create policy ops_write_fixture on fixture for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));
create policy ops_read_campaign on campaign for select using (is_ops());
create policy ops_write_campaign on campaign for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));
create policy ops_read_sponsor on sponsor for select using (is_ops());
create policy ops_write_sponsor on sponsor for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));
create policy ops_read_merchant on merchant for select using (is_ops());
create policy ops_write_merchant on merchant for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));
create policy ops_read_merchant_loc on merchant_location for select using (is_ops());
create policy ops_write_merchant_loc on merchant_location for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));
create policy ops_read_events on event for select using (is_ops(array['super_admin','ops','analyst']::ops_role[]));
create policy ops_read_claims on claim for select using (is_ops());
create policy ops_read_redemptions on redemption_log for select using (is_ops());
create policy ops_read_audit on audit_log for select using (is_ops(array['super_admin']::ops_role[]));
create policy ops_read_support on support_ticket for select using (is_ops());
create policy ops_write_support on support_ticket for update using (is_ops()) with check (is_ops());
create policy ops_read_distribution on distribution_touchpoint for select using (is_ops());
create policy ops_write_distribution on distribution_touchpoint for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));
create policy ops_manage_merchant_users on merchant_user for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));
create policy ops_manage_campaign_merchant on campaign_merchant for all using (is_ops(array['super_admin','ops']::ops_role[])) with check (is_ops(array['super_admin','ops']::ops_role[]));

-- ---------- Merchant portal (scoped, PII-free) ----------
-- A merchant user may read only the campaigns they are assigned to.
create policy merchant_read_own_campaign on campaign for select
  using (merchant_can_access_campaign(id));
-- A merchant may read a claim ONLY for a campaign they can access. Note: the
-- claim row carries no phone/prediction/PII (prompt §29) — those live in other
-- tables the merchant has no policy on.
create policy merchant_read_scoped_claim on claim for select
  using (merchant_can_access_campaign(campaign_id));
-- Merchants read their own membership row.
create policy merchant_read_self on merchant_user for select using (auth_user_id = auth.uid());
create policy merchant_read_own_merchant on merchant for select
  using (exists (select 1 from merchant_user mu where mu.auth_user_id = auth.uid() and mu.merchant_id = merchant.id and mu.is_active));

-- NOTE: no SELECT/INSERT/UPDATE policies are defined for supporter_contact,
-- prediction, consent, otp_challenge, anonymous_session, supporter for the
-- anon/authenticated roles. They are therefore default-DENY and reachable only
-- via the service role in trusted server code. This is intentional.

-- >>> supabase/migrations/0005_base_data.sql
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

-- >>> supabase/migrations/0006_retention_flags.sql
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

-- >>> supabase/migrations/0007_campaign_image.sql
-- Campaign benefit image (prize photo). Mirrors the existing sponsor.logo_url
-- column: nullable, purely presentational, never used for eligibility.
alter table campaign add column image_url text;

-- >>> supabase/migrations/0008_remove_legal_approval.sql
-- Remove the legal-approval workflow entirely.
--
-- Legal/regulatory review of a campaign (raffle rules, prize regulations,
-- sign-off) happens outside FanHour, before a campaign is ever entered into
-- this system. The product must never model, gate, or infer a legal
-- conclusion on its own — that is not FanHour's role. This drops the
-- `regulated_prize` compliance mode and every column that tracked its
-- approval state; only `engagement_only` and `participation_benefit` remain.

-- Guard: refuse to proceed if any campaign still relies on regulated_prize,
-- rather than silently discarding data.
do $$
begin
  if exists (select 1 from campaign where compliance_mode = 'regulated_prize') then
    raise exception 'campaign(s) still use compliance_mode = regulated_prize; reassign them to participation_benefit or engagement_only before running this migration';
  end if;
end $$;

alter table campaign drop constraint if exists campaign_regulated_requires_approval;
alter table campaign drop column if exists legal_approval_status;
alter table campaign drop column if exists legal_reference;
alter table campaign drop column if exists approved_at;
alter table campaign drop column if exists approved_by;

-- The remaining constraint also compares compliance_mode, so it must be
-- dropped before the enum swap below (a check compiled against the old
-- enum's OID cannot be re-validated against the new one) and recreated after.
alter table campaign drop constraint if exists campaign_active_needs_fixture;

-- Postgres enums can't drop a single value in place — recreate the type.
alter type compliance_mode rename to compliance_mode_old;
create type compliance_mode as enum ('engagement_only','participation_benefit');
alter table campaign alter column compliance_mode drop default;
alter table campaign
  alter column compliance_mode type compliance_mode
  using compliance_mode::text::compliance_mode;
alter table campaign alter column compliance_mode set default 'engagement_only';
drop type compliance_mode_old;

drop type if exists legal_approval_status;

alter table campaign add constraint campaign_active_needs_fixture check (
  not (is_active and compliance_mode <> 'engagement_only' and fixture_id is null)
);

-- >>> supabase/migrations/0009_reminders.sql
-- =====================================================================
-- FanHour — Matchweek reminder service + randomised holdout (Part A1).
--
-- MRAF is the North Star metric, but the product has had no mechanism to
-- cause a fan to return. This adds a templated, opt-in SMS/WhatsApp reminder
-- cued to each fixture, with a RANDOMISED HOLDOUT so the pilot can causally
-- attribute MRAF to reminders rather than just observe correlation.
--
-- A subscription requires a VERIFIED phone number (there is no channel to an
-- anonymous cookie), so `reminder_subscription` is keyed by `supporter_id`
-- only — consent is captured via the existing OTP verify flow, right after
-- the fan's first prediction (the moment of maximum intent), not at claim.
-- =====================================================================

alter type consent_type add value 'reminder';

-- The 'resolution' cadence slot fires when the fixture is actually resolved,
-- not merely "some time after kickoff" — needs its own timestamp since
-- `updated_at` can be bumped by unrelated ops edits.
alter table fixture add column resolved_at timestamptz;

create or replace function resolve_fixture_atomic(
  p_fixture_id uuid,
  p_hazem_score int,
  p_opponent_score int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result fixture_result;
begin
  if p_hazem_score < 0 or p_opponent_score < 0 then
    raise exception 'invalid_scores';
  end if;
  v_result := case
    when p_hazem_score > p_opponent_score then 'hazem_win'::fixture_result
    when p_hazem_score < p_opponent_score then 'opponent_win'::fixture_result
    else 'draw'::fixture_result end;

  update fixture
    set hazem_score = p_hazem_score, opponent_score = p_opponent_score,
        result = v_result, status = 'resolved', updated_at = now(),
        resolved_at = coalesce(resolved_at, now())
    where id = p_fixture_id;

  update prediction
    set is_correct = (outcome::text = v_result::text), updated_at = now()
    where fixture_id = p_fixture_id;
end;
$$;

create type reminder_channel as enum ('unifonic_sms', 'whatsapp');
create type reminder_holdout_arm as enum ('treatment', 'holdout');
create type reminder_subscription_state as enum ('active', 'withdrawn');
create type reminder_cadence_slot as enum ('t_minus_48h', 't_minus_2h', 'resolution');
create type reminder_outcome as enum ('sent', 'deferred', 'failed', 'skipped_holdout', 'skipped_cap');

-- One row per supporter. Holdout arm is assigned ONCE, at consent time, and
-- never recomputed — that is what makes the experiment valid.
create table reminder_subscription (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null unique references supporter(id) on delete cascade,
  channel reminder_channel not null default 'unifonic_sms',
  consent_version text not null,
  holdout_arm reminder_holdout_arm not null,
  state reminder_subscription_state not null default 'active',
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index reminder_subscription_state_idx on reminder_subscription(state);
create index reminder_subscription_arm_idx on reminder_subscription(holdout_arm);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  reminder_subscription_id uuid not null references reminder_subscription(id) on delete cascade,
  fixture_id uuid not null references fixture(id),
  cadence_slot reminder_cadence_slot not null,
  template_key text not null,
  template_version text not null,
  channel reminder_channel not null,
  outcome reminder_outcome not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  deferred_until timestamptz,
  opened_at timestamptz,
  provider_ref text,
  error text,
  created_at timestamptz not null default now(),
  -- At most one log row per (subscription, fixture, slot) — this is the
  -- server-side enforcement of the 3-sends-per-fixture cap and de-dup.
  unique (reminder_subscription_id, fixture_id, cadence_slot)
);
create index notification_log_fixture_idx on notification_log(fixture_id);
create index notification_log_outcome_idx on notification_log(outcome);

alter table reminder_subscription enable row level security;
alter table notification_log enable row level security;

-- Default-deny for anon/authenticated roles (no policy granting them
-- access); only the service role (server-only) and ops may read these.
create policy ops_read_reminder_subscription on reminder_subscription for select
  using (is_ops(array['super_admin','ops','analyst']::ops_role[]));
create policy ops_read_notification_log on notification_log for select
  using (is_ops(array['super_admin','ops','analyst']::ops_role[]));

-- >>> supabase/migrations/0010_attribution.sql
-- Part A2 — source attribution. Captured on the FIRST touch only (never
-- overwritten) so a week the club forgets to post is distinguishable from a
-- product problem.
alter table anonymous_session add column source text;

-- >>> supabase/migrations/0011_sponsor_value_evidence.sql
-- Part A4 — sponsor value evidence beyond redemption. One optional,
-- skippable, no-PII tap at the merchant portal after a successful
-- redemption: "is this your first visit?" — null means never asked/skipped.
alter table redemption_log add column first_visit text
  check (first_visit is null or first_visit in ('yes', 'no', 'unsure'));

-- >>> supabase/migrations/0012_fixture_cost_tracking.sql
-- Part A5 — measure the cost model. Four optional numeric inputs (minutes)
-- on the ops fixture-resolution form, replacing the largest assumed
-- variable-cost line in the financial model with measured data.
alter table fixture add column minutes_question_set int check (minutes_question_set is null or minutes_question_set >= 0);
alter table fixture add column minutes_verification int check (minutes_verification is null or minutes_verification >= 0);
alter table fixture add column minutes_resolution int check (minutes_resolution is null or minutes_resolution >= 0);
alter table fixture add column minutes_sponsor_reporting int check (minutes_sponsor_reporting is null or minutes_sponsor_reporting >= 0);

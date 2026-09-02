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

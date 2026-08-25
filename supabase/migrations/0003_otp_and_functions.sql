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

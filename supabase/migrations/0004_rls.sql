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

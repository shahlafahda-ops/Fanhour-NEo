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

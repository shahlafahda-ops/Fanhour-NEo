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

# Migrations

Apply in numeric order. Each file is idempotent-friendly for its own objects but
they are designed to run once, in sequence, on a fresh database.

| File | Purpose |
|---|---|
| `0001_core_schema.sql` | Enums, club, fixture, identity (anon session, supporter, contact), consent, prediction (+ unique invariants) |
| `0002_commercial_schema.sql` | Sponsors, campaigns (+ compliance/cap CHECKs), merchants, claims, events, support, feature flags, audit log, distribution |
| `0003_otp_and_functions.sql` | OTP challenges, rate limit + `increment_rate_limit`, `issue_claim_atomic`, `redeem_claim_atomic`, `resolve_fixture_atomic` |
| `0004_rls.sql` | Row Level Security: default-deny, public reads, ops/merchant scoping helpers & policies |
| `0005_base_data.sql` | Al Hazem club + feature-flag defaults (no fixtures/sponsors/participation) |

Apply with the Supabase CLI (`supabase db push`), the SQL editor, or:
```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

`auth.uid()` and the `auth` schema are provided by Supabase. For local psql
validation without Supabase, stub it:
```sql
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
```

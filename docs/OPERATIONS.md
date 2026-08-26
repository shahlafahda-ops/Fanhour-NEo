# Operations

## Environment variables
See `.env.example` for the full annotated list. Summary:

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | public | canonical URL for OG/share/OTP |
| `NEXT_PUBLIC_APP_ENV` | public | development / staging / production |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | public | browser + RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server** | never `NEXT_PUBLIC_` |
| `OTP_PROVIDER` | server | mock \| twilio \| unifonic (mock forbidden in prod) |
| `TWILIO_*` / `UNIFONIC_*` | server | provider credentials |
| `SUPPORT_DESTINATION` | server | support ticket delivery |
| `PRIVACY_POLICY_VERSION` / `TERMS_VERSION` | server | stamped on consent |
| `ALLOW_TEST_DATA` | server | must be `false` in production |
| `COMMUNITY_MIN_SAMPLE` | public | default 20 |
| `BENEFIT_MIN_AGE` | public | default 18 |
| `DEFAULT_CUTOFF_MINUTES_BEFORE_KICKOFF` | server | default 5 |
| `DATABASE_URL` | server (tooling) | direct Postgres URL for migrations/seed |

## Applying migrations
Use the Supabase SQL editor, the Supabase CLI (`supabase db push`), or psql:
```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```
`0005_base_data.sql` inserts the Al Hazem club and feature-flag defaults only —
no fixtures, sponsors, or fabricated participation.

## Seeding (dev only)
`npm run seed` applies `supabase/seed.sql` (clearly-labelled `[تجريبي]` test
data). It **refuses** when `NEXT_PUBLIC_APP_ENV=production` or
`ALLOW_TEST_DATA=false`.

## Creating the first ops user
1. Create a Supabase Auth user (dashboard or `auth.admin.createUser`).
2. Insert an `ops_user` row mapping that `auth_user_id` to role `super_admin`.
3. Sign in at `/ops`.

## Running a matchday
1. `/ops/fixtures` → add the fixture (kickoff in Riyadh time; cutoff auto-set).
2. Optionally `/ops/campaigns` → configure sponsor + campaign, then activate.
3. Optionally `/ops/merchants` → create merchant, staff accounts, grant campaign access.
4. After the match: `/ops/fixtures` → enter the score → predictions grade
   automatically and the fan result screen updates.

## Deployment
Vercel (recommended) or any Node host: set env vars, `npm run build`,
`npm start`. Point Supabase at the production project and apply migrations
first. Confirm the [launch checklist](./LAUNCH_CHECKLIST.md) before going live.

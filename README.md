# FanHour — Al Hazem Pilot 1

A lightweight Saudi football fan-engagement and sponsor-activation platform.
FanHour attaches one fast, meaningful digital ritual to something supporters
already care about: the next **Al Hazem** match.

> The loop: **fixture → one-tap prediction → immediate feedback → the match →
> resolution → personal record → optional sponsor benefit → verified
> redemption → next fixture.**

This repository is the production rebuild (mobile web, Arabic-first, true RTL).
The earlier NEOM prototype is preserved under [`legacy/`](./legacy) for
reference and is **not** authoritative.

## Stack

- **Next.js 14** (App Router) · **React 18** · **TypeScript (strict)**
- **Tailwind CSS** — FanHour brand system, mobile-first, RTL
- **Supabase** — PostgreSQL, Row Level Security, Auth, server functions
- **Vitest** (unit/integration) · **Playwright** (E2E)
- **Zod** for request validation

## Quick start

```bash
cp .env.example .env.local        # fill in Supabase + OTP config
npm install
# apply migrations to your Supabase/Postgres (see docs/OPERATIONS.md)
npm run seed                      # dev only — loads clearly-labelled TEST data
npm run dev                       # http://localhost:3000  → /app/alhazem
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm test` | Vitest unit/integration suite |
| `npm run test:e2e` | Playwright E2E (needs running app + seeded DB) |
| `npm run seed` | Guarded dev seed (refuses in production) |

## Routes

**Fan** `/app/alhazem` · `/pilot` (alias) · `/app/alhazem/match/[slug]` ·
`/app/alhazem/record` · `/app/alhazem/benefit/[slug]`
**Ops** `/ops` (RBAC) · **Merchant** `/merchant` (scoped auth)
**Legal** `/privacy` · `/terms` · `/campaign-rules/[slug]`

## Documentation

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md)
- [Security](docs/SECURITY.md) · [Analytics](docs/ANALYTICS.md)
- [Operations](docs/OPERATIONS.md) · [Testing](docs/TESTING.md)
- [Legal configuration](docs/LEGAL_CONFIGURATION.md)
- [Launch checklist](docs/LAUNCH_CHECKLIST.md) ← **GO/NO-GO gate**

## What FanHour is / is not

FanHour is a fan-engagement and sponsor-activation platform. It is **not**
betting, gambling, a lottery, a wallet, a bank, ticketing, e-commerce, a CRM,
or a social network. There are no daily streaks, no global leaderboards, no
token economy, and no other clubs.

#!/usr/bin/env node
/**
 * Guarded dev seed runner. Refuses to run test data in production or when
 * ALLOW_TEST_DATA is false (prompt §45, §77). Applies supabase/seed.sql via
 * the DATABASE_URL (a direct Postgres connection string).
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? 'development';
const allowTestData = (process.env.ALLOW_TEST_DATA ?? 'true') === 'true';
const dbUrl = process.env.DATABASE_URL;

if (appEnv === 'production') {
  console.error('REFUSING: cannot seed test data in production (NEXT_PUBLIC_APP_ENV=production).');
  process.exit(1);
}
if (!allowTestData) {
  console.error('REFUSING: ALLOW_TEST_DATA is false.');
  process.exit(1);
}
if (!dbUrl) {
  console.error('Set DATABASE_URL (direct Postgres connection) to seed.');
  process.exit(1);
}

const sql = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
try {
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log('Seed applied (test data).');
} catch {
  console.error('Seed failed.');
  process.exit(1);
}

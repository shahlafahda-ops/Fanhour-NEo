#!/usr/bin/env node
/*
 * One-command demo launcher.
 *
 * Standing in front of a room is the wrong moment to remember four commands and
 * two environment variables. This resets the data, seeds fixtures and prior
 * engagement, and starts the server in demo mode — then prints the three URLs
 * the presenter actually needs.
 *
 * Demo only. It deletes the local database, so it refuses to run if one exists
 * that it did not create, unless --force is passed.
 */
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const force = process.argv.includes('--force');
const dataDir = process.env.FH_DATA_DIR || path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'fanhour.db');

const PORT = process.env.PORT || '8787';
const BOARD_KEY = process.env.FH_BOARD_KEY || 'dev-board-key';
const ADMIN_KEY = process.env.FH_ADMIN_KEY || 'dev-admin-key';

/* ── Guard: never silently destroy a database we did not make ───── */

if (fs.existsSync(dbPath) && !force) {
  const age = Date.now() - fs.statSync(dbPath).mtimeMs;
  const hours = Math.round(age / 3600000);
  console.error(
    `\n  A database already exists at ${dbPath} (last written ~${hours}h ago).\n` +
    '  Starting the demo would delete it.\n\n' +
    '  If it is only demo data, re-run with --force:\n' +
    '      npm run demo:start -- --force\n',
  );
  process.exit(1);
}

const run = (label, args, env = {}) => {
  const res = spawnSync(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) {
    console.error(`  ✕ ${label} failed`);
    process.exit(1);
  }
  console.log(`  ✓ ${label}`);
  return res.stdout?.toString() || '';
};

console.log('\n  FanHour × Al Hazem — demo setup\n');

fs.rmSync(dataDir, { recursive: true, force: true });
console.log('  ✓ cleared previous demo data');

run('seeded fixtures F1–F10 and the open F1 challenge', ['server/seed.js']);
const traffic = run('generated prior engagement', ['server/demo-seed.js'], { FH_DEMO: '1' });

// Surface the seeded totals so the presenter knows what the board opens on.
const match = traffic.match(/completions:\s*(\d+)[\s\S]*?verifiedFans:\s*(\d+)[\s\S]*?claims:\s*(\d+)[\s\S]*?redemptions:\s*(\d+)/);
if (match) {
  const [, completions, fans, claims, redemptions] = match;
  console.log(
    `\n  Board opens on: ${completions} completions · ${fans} verified fans · ` +
    `${claims} claims · ${redemptions} redemptions`,
  );
}

/* ── Best-effort LAN address, so phones in the room can reach it ── */

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

const lan = lanAddress();
const host = lan ? `http://${lan}:${PORT}` : `http://localhost:${PORT}`;

console.log(`
  ─────────────────────────────────────────────────────────
  Board (projector)   ${host}/board?k=${BOARD_KEY}
  Fan journey         ${host}/
  Merchant validator  ${host}/merchant     staff_demo / 1234
  ─────────────────────────────────────────────────────────
`);

if (!lan) {
  console.log('  No LAN address found — phones on the room wifi may not reach localhost.\n');
}

console.log(`  Reset between runs:
      curl -X POST -H "x-fh-admin-key: ${ADMIN_KEY}" ${host}/api/admin/demo/reset
      npm run demo

  Demo mode shows the OTP on screen and FAILS the launch-readiness gate.
  Ctrl-C to stop.
`);

const server = spawn(process.execPath, ['server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, FH_DEMO: '1', PORT, FH_BOARD_KEY: BOARD_KEY, FH_ADMIN_KEY: ADMIN_KEY },
});

const stop = () => { server.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));

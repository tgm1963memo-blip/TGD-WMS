// Monthly restore drill: restores the latest backup into a throwaway
// postgres:17 Docker container and checks every table's row count against
// that backup's manifest.json. Never touches production.
//
//   node restore-test.mjs [--root C:\TGD-Backups] [--folder 2026-09-28_0200]
//
// Needs Docker Desktop running.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROW_COUNT_SQL, parseRowCounts } from './backupLib.mjs';

const execFileAsync = promisify(execFile);
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = arg('--root') ?? 'C:\\TGD-Backups';
const CONTAINER = 'tgd-restore-test';

// Roles Supabase objects reference; creating them lets policies/grants apply
// instead of failing, so the drill surfaces real problems, not role noise.
const SUPABASE_ROLES = ['anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'authenticator', 'dashboard_user'];

function latestBackupFolder() {
  const daily = path.join(ROOT, 'daily');
  const folders = readdirSync(daily).filter((f) => existsSync(path.join(daily, f, 'manifest.json'))).sort();
  if (!folders.length) throw new Error(`No completed backup (with manifest.json) under ${daily}`);
  return folders[folders.length - 1];
}

async function docker(args, options = {}) {
  return execFileAsync('docker', args, { maxBuffer: 64 * 1024 * 1024, ...options });
}

async function waitForPostgres() {
  for (let i = 0; i < 60; i += 1) {
    try { await docker(['exec', CONTAINER, 'pg_isready', '-U', 'postgres']); return; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('postgres container did not become ready');
}

async function main() {
  const folder = arg('--folder') ?? latestBackupFolder();
  const dir = path.join(ROOT, 'daily', folder);
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  console.log(`restore test of ${dir}`);

  await docker(['rm', '-f', CONTAINER]).catch(() => {});
  await docker(['run', '-d', '--name', CONTAINER, '-e', 'POSTGRES_PASSWORD=restoretest', 'postgres:17']);
  try {
    await waitForPostgres();
    const roleSql = SUPABASE_ROLES.map((r) => `do $$ begin create role ${r} nologin; exception when duplicate_object then null; end $$;`).join('\n');
    await docker(['exec', CONTAINER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=0', '-c', roleSql]);
    await docker(['cp', path.join(dir, manifest.database.file), `${CONTAINER}:/tmp/db_full.dump`]);

    // Supabase-only extensions (pg_graphql, vault, ...) do not exist in plain
    // postgres, so pg_restore reports some errors; the row counts below are
    // what decide pass/fail.
    const restore = await docker(['exec', CONTAINER, 'pg_restore', '-U', 'postgres', '-d', 'postgres', '--no-owner', '--no-privileges', '/tmp/db_full.dump'])
      .then(() => ({ errors: 0 }))
      .catch((e) => ({ errors: (String(e.stderr).match(/error:/gi) ?? []).length }));
    console.log(`pg_restore finished (${restore.errors} error lines, expected for Supabase-only extensions)`);

    const { stdout } = await docker(['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c', ROW_COUNT_SQL]);
    const restored = parseRowCounts(stdout);

    const mismatches = [];
    for (const [table, expected] of Object.entries(manifest.database.rowCounts)) {
      if (!table.startsWith('public.') && table !== 'auth.users') continue;
      const actual = restored[table];
      if (actual !== expected) mismatches.push(`${table}: backup ${expected}, restored ${actual ?? 'missing'}`);
    }

    const checked = Object.keys(manifest.database.rowCounts).filter((t) => t.startsWith('public.') || t === 'auth.users').length;
    if (mismatches.length) {
      console.log(`RESTORE TEST FAILED — ${mismatches.length}/${checked} tables differ:`);
      mismatches.forEach((m) => console.log(`  ${m}`));
      process.exitCode = 1;
    } else {
      console.log(`RESTORE TEST OK — ${checked} tables (public + auth.users) match the manifest`);
    }
  } finally {
    await docker(['rm', '-f', CONTAINER]).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`restore test error: ${error.message}`);
  process.exit(1);
});

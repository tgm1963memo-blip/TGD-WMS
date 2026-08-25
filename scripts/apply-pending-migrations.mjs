import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();

// Previously applied: 053–091 (applied via earlier runs of this script).
//
// WARNING: 090_fix_review_deposit_restore_behaviors.sql recreates
// tgd_review_customer_deposit_request from a snapshot that predates the
// configurable-permission upgrade in supabase/migrations/
// 20260708100008_tgd_wms_warehouse_admin_approval_permissions.sql (and the
// unconfirmed-qty-guard / tracking-code-assignment additions in
// supabase/migrations/20260810090000_require_confirmed_qty_before_completing_documents.sql).
// Re-running it silently regresses all of that -- confirmed live on
// 2026-08-24 (warehouse_admin lost the ability to review deposit requests
// despite having the role permission configured) and corrected by
// re-applying 20260810090000. Never add 090 back to this list; if this
// script needs to run again, add ONLY genuinely new database/migrations/*.sql
// files that don't shadow anything already superseded under supabase/migrations/.
const MIGRATIONS = [];

function runSql(sql, label) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-migration-'));
  const filePath = path.join(dir, `${label}.sql`);
  writeFileSync(filePath, sql, 'utf8');
  console.log(`Applying ${label}...`);
  try {
    execSync(`npx supabase db query --linked -f "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(`✓ Applied ${label}`);
    return 'applied';
  } catch (err) {
    const msg = err.stderr || err.message || '';
    if (
      msg.includes('already exists') ||
      msg.includes('duplicate key') ||
      msg.includes('already been done')
    ) {
      console.log(`⚠ Skipped ${label} (already applied: ${msg.match(/"[^"]+"/) || ''})`);
      return 'skipped';
    }
    console.error(`✗ FAILED ${label}:\n${msg}`);
    return 'failed';
  }
}

function main() {
  const results = { applied: [], skipped: [], failed: [] };
  for (const fileName of MIGRATIONS) {
    const filePath = path.join(ROOT, 'database', 'migrations', fileName);
    const sql = readFileSync(filePath, 'utf8');
    const status = runSql(sql, fileName.replace('.sql', ''));
    results[status].push(fileName);
  }
  console.log('\n=== Migration Summary ===');
  console.log(JSON.stringify(results, null, 2));
  if (results.failed.length > 0) process.exit(1);
}

main();

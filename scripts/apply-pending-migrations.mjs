import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();

// Previously applied: 053–081 (applied via earlier runs of this script)
// Newly pending: 082–086
const MIGRATIONS = [
  '087_drop_5param_notification_overload.sql',
];

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

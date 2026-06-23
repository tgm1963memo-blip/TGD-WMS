/**
 * Restore UAT demo foundation after cleanup or fresh reset.
 * Safe to re-run (idempotent seeds + upserts).
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: ROOT, stdio: 'inherit', shell: true });
}

function main() {
  run('node scripts/apply-single-migration.mjs 067_tgd_wms_demo_customer_seed.sql');
  run('node scripts/ensure-uat-policy-seed.mjs');
  run('npm run uat:bootstrap-all-roles');
  run('npm run uat:bootstrap-customer');
  run('node scripts/validate-uat-admin-key.mjs');
  run('node scripts/verify-schema-relationships.mjs');
  console.log('\nUAT environment restore complete.');
}

main();

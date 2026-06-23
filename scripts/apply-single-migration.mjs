import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const fileName = process.argv[2];
if (!fileName) {
  console.error('Usage: node scripts/apply-single-migration.mjs <migration-file.sql>');
  process.exit(1);
}

const ROOT = process.cwd();
const filePath = path.join(ROOT, 'database', 'migrations', fileName);
const sql = readFileSync(filePath, 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'tgd-migration-'));
const tmpPath = path.join(dir, fileName);
writeFileSync(tmpPath, sql, 'utf8');

console.log(`Applying ${fileName}...`);
const output = execSync(`npx supabase db query --linked -f "${tmpPath}"`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
console.log(output);
console.log(JSON.stringify({ ok: true, applied: fileName }, null, 2));

/**
 * Sync only SUPABASE_SERVICE_ROLE_KEY to Vercel Preview (all branches).
 * Separate script because Preview may require branch handling in newer Vercel CLI.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { UAT_PROJECT_REF } from './lib/uatSupabaseAdmin.mjs';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');

function parseEnvFile(filePath) {
  const map = new Map();
  readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith('#') || !line.includes('=')) return;
    const idx = line.indexOf('=');
    map.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  });
  return map;
}

function main() {
  if (!existsSync(ENV_PATH)) throw new Error('Missing .env.local');
  const env = parseEnvFile(ENV_PATH);
  const value = env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = env.get('VITE_SUPABASE_URL') || '';
  if (!url.includes(UAT_PROJECT_REF)) throw new Error('Not UAT Supabase URL');
  if (!value) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');

  const result = spawnSync(
    'npx',
    ['vercel', 'env', 'add', 'SUPABASE_SERVICE_ROLE_KEY', 'preview', '--force', '--yes', '--value', value],
    { cwd: ROOT, encoding: 'utf8', shell: true },
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, name: 'SUPABASE_SERVICE_ROLE_KEY', environment: 'preview' }, null, 2));
}

main();

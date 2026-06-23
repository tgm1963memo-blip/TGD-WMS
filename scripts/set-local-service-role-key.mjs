/**
 * Update SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Usage (preferred after Dashboard rotation):
 *   node scripts/set-local-service-role-key.mjs --value "sb_secret_..."
 *
 * Fallback (legacy JWT from Supabase CLI — not a true rotation):
 *   node scripts/set-local-service-role-key.mjs --from-cli
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { UAT_PROJECT_REF } from './lib/uatSupabaseAdmin.mjs';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');

function parseArgs() {
  const valueArg = process.argv.find((arg) => arg.startsWith('--value='));
  if (valueArg) return { key: valueArg.slice('--value='.length).trim(), source: 'arg' };
  if (process.argv.includes('--from-cli')) return { key: fetchLegacyServiceRoleFromCli(), source: 'cli-legacy' };
  return null;
}

function fetchLegacyServiceRoleFromCli() {
  const result = spawnSync(
    'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', UAT_PROJECT_REF, '-o', 'json'],
    { encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Unable to list Supabase API keys');
  }
  const keys = JSON.parse(result.stdout);
  const legacy = keys.find((row) => row.id === 'service_role' || row.name === 'service_role');
  if (!legacy?.api_key) throw new Error('Legacy service_role key not found from CLI');
  return legacy.api_key;
}

function updateEnvLocal(key) {
  if (!existsSync(ENV_PATH)) throw new Error(`Missing ${ENV_PATH}`);
  const lines = readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  let replaced = false;
  const next = lines.map((line) => {
    if (!line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) return line;
    replaced = true;
    return `SUPABASE_SERVICE_ROLE_KEY=${key}`;
  });
  if (!replaced) next.push(`SUPABASE_SERVICE_ROLE_KEY=${key}`);
  writeFileSync(ENV_PATH, `${next.join('\n').replace(/\n?$/, '\n')}`, 'utf8');
}

function main() {
  const input = parseArgs();
  if (!input?.key) {
    console.error('Provide --value="sb_secret_..." after Dashboard rotation, or --from-cli for legacy JWT refresh.');
    process.exit(1);
  }
  if (input.key.length < 20) throw new Error('Service role key looks too short');
  updateEnvLocal(input.key);
  console.log(JSON.stringify({
    ok: true,
    updated: 'SUPABASE_SERVICE_ROLE_KEY',
    source: input.source,
    keyPrefix: input.key.slice(0, 12),
    keyType: input.key.startsWith('sb_secret_') ? 'secret' : 'legacy-jwt',
  }, null, 2));
}

main();

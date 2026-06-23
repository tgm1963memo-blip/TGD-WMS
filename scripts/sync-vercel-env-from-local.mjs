/**
 * Sync selected secrets from .env.local to Vercel project env.
 * UAT project: tgc-wms (lievvsqbosvrolkrftna)
 *
 * Usage:
 *   node scripts/sync-vercel-env-from-local.mjs
 *   node scripts/sync-vercel-env-from-local.mjs --dry-run
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const UAT_PROJECT_REF = 'lievvsqbosvrolkrftna';
const dryRun = process.argv.includes('--dry-run');
const onlyEnvArg = process.argv.find((arg) => arg.startsWith('--only='));
const onlyEnvironments = onlyEnvArg
  ? onlyEnvArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const SYNC_PLAN = [
  { name: 'VITE_SUPABASE_URL', environments: ['production', 'preview', 'development'] },
  { name: 'VITE_SUPABASE_ANON_KEY', environments: ['production', 'preview', 'development'] },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', environments: ['production', 'preview', 'development'] },
  { name: 'SITE_URL', environments: ['production'], fallback: 'https://tgc-wms.vercel.app' },
  { name: 'SMTP_HOST', environments: ['production'] },
  { name: 'SMTP_PORT', environments: ['production'] },
  { name: 'SMTP_USER', environments: ['production'] },
  { name: 'SMTP_PASS', environments: ['production'] },
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  const map = new Map();
  readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith('#') || !line.includes('=')) return;
    const idx = line.indexOf('=');
    map.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  });
  return map;
}

function assertUatUrl(url) {
  if (!url?.includes(UAT_PROJECT_REF)) {
    throw new Error(`Refusing sync: VITE_SUPABASE_URL must point to UAT (${UAT_PROJECT_REF})`);
  }
}

function upsertVercelEnv(name, value, environment) {
  if (dryRun) {
    console.log(`[dry-run] ${name} -> ${environment}`);
    return;
  }

  const result = spawnSync(
    'npx',
    ['vercel', 'env', 'add', name, environment, '--force', '--yes', '--value', value],
    {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    },
  );

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(detail || `vercel env add failed with exit ${result.status}`);
  }

  console.log(`✓ ${name} -> ${environment}`);
}

function main() {
  const env = parseEnvFile(ENV_PATH);
  const supabaseUrl = env.get('VITE_SUPABASE_URL') || '';
  assertUatUrl(supabaseUrl);

  if (!env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local — rotate key in Supabase Dashboard first');
  }

  const siteUrl = env.get('SITE_URL') || env.get('UAT_BASE_URL') || 'https://tgc-wms.vercel.app';

  const results = [];

  for (const item of SYNC_PLAN) {
    const value = env.get(item.name) ?? item.fallback;
    if (!value) {
      results.push({ name: item.name, status: 'skipped', reason: 'no value in .env.local' });
      continue;
    }

    for (const environment of item.environments) {
      if (onlyEnvironments && !onlyEnvironments.includes(environment)) continue;
      try {
        const resolved = item.name === 'SITE_URL' ? siteUrl : value;
        upsertVercelEnv(item.name, resolved, environment);
        results.push({ name: item.name, environment, status: 'updated' });
      } catch (error) {
        results.push({
          name: item.name,
          environment,
          status: 'failed',
          error: error.stderr?.toString() || error.message || String(error),
        });
      }
    }
  }

  const failures = results.filter((row) => row.status === 'failed');
  const previewFailures = failures.filter((row) => row.environment === 'preview');
  const criticalFailures = failures.filter((row) => row.environment === 'production');

  console.log(JSON.stringify({
    ok: criticalFailures.length === 0,
    dryRun,
    project: 'tgc-wms',
    syncedKeys: [...new Set(results.filter((r) => r.status === 'updated').map((r) => r.name))],
    previewFailures: previewFailures.length,
    results,
    next: dryRun
      ? 'Re-run without --dry-run to apply'
      : 'Redeploy production for serverless API routes: vercel --prod',
  }, null, 2));

  if (criticalFailures.length) process.exit(1);
}

main();

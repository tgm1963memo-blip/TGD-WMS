import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import path from 'node:path';

export const UAT_PROJECT_REF = 'lievvsqbosvrolkrftna';

export function loadUatEnv() {
  dotenv.config({ path: path.join(process.cwd(), '.env.local') });
}

export function assertUatSupabaseUrl(url) {
  loadUatEnv();
  const normalized = String(url ?? process.env.VITE_SUPABASE_URL ?? '').trim();
  if (!normalized.includes(UAT_PROJECT_REF)) {
    throw new Error(
      `Refusing operation: VITE_SUPABASE_URL must point to UAT (${UAT_PROJECT_REF}). Got: ${normalized || '(empty)'}`,
    );
  }
  return normalized;
}

export function resolveServiceRoleKey({ allowCliFallback = true } = {}) {
  loadUatEnv();

  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (fromEnv && fromEnv.length > 20) {
    return { key: fromEnv, source: 'env' };
  }

  if (!allowCliFallback) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const raw = execSync(`npx supabase projects api-keys --project-ref ${UAT_PROJECT_REF} -o json`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const keys = JSON.parse(raw);
  const legacy = keys.find((row) => row.id === 'service_role' || row.name === 'service_role');
  if (legacy?.api_key) {
    return { key: legacy.api_key, source: 'cli-legacy-service_role' };
  }

  throw new Error('Unable to resolve UAT service role key from env or Supabase CLI');
}

export function createUatAdminClient(options = {}) {
  loadUatEnv();
  const url = assertUatSupabaseUrl();
  const { key, source } = resolveServiceRoleKey(options);
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { supabase, keySource: source };
}

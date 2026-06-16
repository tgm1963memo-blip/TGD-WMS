import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

const TARGET_EMAIL = (process.env.UAT_TARGET_WAREHOUSE_EMAIL || 'thitiwat.tan@tgm.co.th').toLowerCase();
const WAREHOUSE_ROLE = process.env.UAT_TARGET_WAREHOUSE_ROLE || 'warehouse_staff';

function getServiceRoleKey() {
  const raw = execSync('npx supabase projects api-keys --project-ref lievvsqbosvrolkrftna', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) throw new Error('Unable to parse Supabase API keys output');
  const payload = JSON.parse(raw.slice(jsonStart));
  const key = payload.keys?.find((row) => row.name === 'service_role')?.api_key;
  if (!key) throw new Error('service_role key not found');
  return key;
}

function upsertEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  const lines = existsSync(envPath) ? readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  const map = new Map();

  lines.forEach((line) => {
    if (!line || line.startsWith('#') || !line.includes('=')) return;
    const idx = line.indexOf('=');
    map.set(line.slice(0, idx), line.slice(idx + 1));
  });

  map.set('UAT_EMAIL', TARGET_EMAIL);
  map.set('UAT_WAREHOUSE_EMAIL', TARGET_EMAIL);
  if (!map.get('UAT_WAREHOUSE_PASSWORD') && map.get('UAT_PASSWORD')) {
    map.set('UAT_WAREHOUSE_PASSWORD', map.get('UAT_PASSWORD'));
  }

  const next = [...map.entries()].map(([key, value]) => `${key}=${value}`).join('\n');
  writeFileSync(envPath, `${next}\n`, 'utf8');
}

function runSql(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-uat-sql-'));
  const filePath = path.join(dir, 'query.sql');
  writeFileSync(filePath, sql, 'utf8');
  const raw = execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) return null;
  return JSON.parse(raw.slice(jsonStart));
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('Missing VITE_SUPABASE_URL in .env.local');

  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  const authUser = listed.users.find((user) => user.email?.toLowerCase() === TARGET_EMAIL);
  if (!authUser) {
    throw new Error(`Auth user not found for ${TARGET_EMAIL}. Create the account in Supabase Auth first.`);
  }

  const before = runSql(`
    select id, auth_user_id, email, role, customer_id, is_active
    from public.tgd_user_profiles
    where lower(email) = lower('${TARGET_EMAIL}')
       or auth_user_id = '${authUser.id}'
    limit 1;
  `);

  const existing = before?.rows?.[0];
  if (!existing) {
    throw new Error(`Profile row not found for ${TARGET_EMAIL}. Link auth user to tgd_user_profiles first.`);
  }

  runSql(`
    update public.tgd_user_profiles
    set
      auth_user_id = '${authUser.id}',
      email = '${TARGET_EMAIL}',
      role = '${WAREHOUSE_ROLE}',
      customer_id = null,
      is_active = true,
      updated_at = now()
    where id = '${existing.id}';
  `);

  const after = runSql(`
    select id, auth_user_id, email, role, customer_id, is_active
    from public.tgd_user_profiles
    where id = '${existing.id}'
    limit 1;
  `);

  upsertEnvLocal();

  console.log(JSON.stringify({
    ok: true,
    email: TARGET_EMAIL,
    authUserId: authUser.id,
    profileId: existing.id,
    previousRole: existing.role,
    role: WAREHOUSE_ROLE,
    profile: after?.rows?.[0] ?? null,
    envUpdated: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

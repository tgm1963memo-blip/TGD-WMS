import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

const WAREHOUSE_EMAIL = 'staff.test@tgd-wms.local';
const WAREHOUSE_ROLE = 'warehouse_staff';
const PROFILE_ID = '77777777-7777-4777-8777-777777777777';

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

function getWarehousePassword() {
  return process.env.UAT_WAREHOUSE_PASSWORD || process.env.UAT_PASSWORD || 'TgdWmsDemo2026!';
}

function upsertEnvLocal(password) {
  const envPath = path.join(ROOT, '.env.local');
  const lines = existsSync(envPath) ? readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  const map = new Map();

  lines.forEach((line) => {
    if (!line || line.startsWith('#') || !line.includes('=')) return;
    const idx = line.indexOf('=');
    map.set(line.slice(0, idx), line.slice(idx + 1));
  });

  map.set('UAT_WAREHOUSE_EMAIL', WAREHOUSE_EMAIL);
  map.set('UAT_WAREHOUSE_PASSWORD', password);

  const next = [...map.entries()].map(([key, value]) => `${key}=${value}`).join('\n');
  writeFileSync(envPath, `${next}\n`, 'utf8');
}

async function ensureAuthUser(supabase, password) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-uat-sql-'));
  const filePath = path.join(dir, 'query.sql');
  writeFileSync(filePath, `select id, email from auth.users where email = '${WAREHOUSE_EMAIL}' limit 1`, 'utf8');
  const raw = execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    const res = JSON.parse(raw.slice(jsonStart));
    if (res.rows && res.rows.length > 0) return res.rows[0];
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: WAREHOUSE_EMAIL,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

function runSql(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-uat-sql-'));
  const filePath = path.join(dir, 'query.sql');
  writeFileSync(filePath, sql, 'utf8');
  execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('Missing VITE_SUPABASE_URL in .env.local');

  const password = getWarehousePassword();
  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authUser = await ensureAuthUser(supabase, password);

  runSql(`
    insert into public.tgd_user_profiles (id, auth_user_id, email, role, customer_id, is_active)
    values ('${PROFILE_ID}', '${authUser.id}', '${WAREHOUSE_EMAIL}', '${WAREHOUSE_ROLE}', null, true)
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      role = excluded.role,
      customer_id = excluded.customer_id,
      is_active = true,
      updated_at = now();
  `);

  upsertEnvLocal(password);

  console.log(JSON.stringify({
    ok: true,
    warehouseEmail: WAREHOUSE_EMAIL,
    authUserId: authUser.id,
    profileId: PROFILE_ID,
    role: WAREHOUSE_ROLE,
    envUpdated: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

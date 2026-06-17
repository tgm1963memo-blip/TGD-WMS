import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

const ADMIN_EMAIL = (process.env.UAT_TARGET_ADMIN_EMAIL || 'thitiwat.tan@tgm.co.th').toLowerCase();
const WAREHOUSE_ADMIN_EMAIL = (process.env.UAT_WAREHOUSE_ADMIN_EMAIL || 'warehouse.admin@tgm.co.th').toLowerCase();
const WAREHOUSE_ADMIN_PROFILE_ID = '88888888-8888-4888-8888-888888888888';

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

function getPassword() {
  return process.env.UAT_WAREHOUSE_ADMIN_PASSWORD || process.env.UAT_DEMO_PASSWORD || process.env.UAT_PASSWORD || 'TgdWmsDemo2026!';
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

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function ensureAuthUser(supabase, email, password) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  const normalized = email.toLowerCase();
  const existing = listed.users.find((user) => user.email?.toLowerCase() === normalized);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('Missing VITE_SUPABASE_URL in .env.local');

  const password = getPassword();
  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminAuth = await ensureAuthUser(supabase, ADMIN_EMAIL, password);
  const adminBefore = runSql(`
    select id, email, role
    from public.tgd_user_profiles
    where lower(email) = lower(${sqlLiteral(ADMIN_EMAIL)})
       or auth_user_id = ${sqlLiteral(adminAuth.id)}
    limit 1;
  `)?.rows?.[0];

  if (!adminBefore) {
    throw new Error(`Profile not found for ${ADMIN_EMAIL}`);
  }

  runSql(`
    update public.tgd_user_profiles
    set
      auth_user_id = ${sqlLiteral(adminAuth.id)},
      email = ${sqlLiteral(ADMIN_EMAIL)},
      role = 'admin',
      customer_id = null,
      is_active = true,
      updated_at = now()
    where id = ${sqlLiteral(adminBefore.id)};
  `);

  const warehouseAdminAuth = await ensureAuthUser(supabase, WAREHOUSE_ADMIN_EMAIL, password);
  runSql(`
    insert into public.tgd_user_profiles (
      id, auth_user_id, email, role, customer_id, is_active
    ) values (
      ${sqlLiteral(WAREHOUSE_ADMIN_PROFILE_ID)},
      ${sqlLiteral(warehouseAdminAuth.id)},
      ${sqlLiteral(WAREHOUSE_ADMIN_EMAIL)},
      'warehouse_admin',
      null,
      true
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      role = 'warehouse_admin',
      customer_id = null,
      is_active = true,
      updated_at = now();
  `);

  const adminAfter = runSql(`
    select id, email, role, is_active
    from public.tgd_user_profiles
    where id = ${sqlLiteral(adminBefore.id)}
    limit 1;
  `)?.rows?.[0];

  const warehouseAdminAfter = runSql(`
    select id, email, role, is_active
    from public.tgd_user_profiles
    where id = ${sqlLiteral(WAREHOUSE_ADMIN_PROFILE_ID)}
    limit 1;
  `)?.rows?.[0];

  console.log(JSON.stringify({
    ok: true,
    passwordHint: 'UAT_PASSWORD / UAT_DEMO_PASSWORD / default TgdWmsDemo2026!',
    admin: {
      email: ADMIN_EMAIL,
      previousRole: adminBefore.role,
      profile: adminAfter,
    },
    warehouseAdmin: {
      email: WAREHOUSE_ADMIN_EMAIL,
      profile: warehouseAdminAfter,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

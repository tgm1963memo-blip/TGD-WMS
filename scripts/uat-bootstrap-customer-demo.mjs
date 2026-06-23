import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { resolveServiceRoleKey } from './lib/uatSupabaseAdmin.mjs';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

const CUSTOMER_EMAIL = 'customer.test@tgd-wms.local';
const CUSTOMER_ROLE = 'customer_user';
const CUSTOMER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const PROFILE_ID = '66666666-6666-4666-8666-666666666666';
const CATALOG_CODE = 'CUS-FLOW-01';
const CATALOG_NAME = 'Flow Test Product';
const INTERNAL_CODE = 'FRZ-FLOW-01';

function getServiceRoleKey() {
  return resolveServiceRoleKey().key;
}

function getCustomerPassword() {
  return process.env.UAT_CUSTOMER_PASSWORD || process.env.UAT_PASSWORD || 'TgdWmsDemo2026!';
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

  map.set('UAT_CUSTOMER_EMAIL', CUSTOMER_EMAIL);
  map.set('UAT_CUSTOMER_PASSWORD', password);
  map.set('UAT_CUSTOMER_CODE', map.get('UAT_CUSTOMER_CODE') || 'Demo Customer Alpha');
  map.set('UAT_CUSTOMER_PRODUCT_CODE', map.get('UAT_CUSTOMER_PRODUCT_CODE') || CATALOG_CODE);
  map.set('UAT_PRODUCT_CODE', map.get('UAT_PRODUCT_CODE') || INTERNAL_CODE);
  map.set('UAT_PRODUCT_NAME', map.get('UAT_PRODUCT_NAME') || CATALOG_NAME);

  const next = [...map.entries()].map(([key, value]) => `${key}=${value}`).join('\n');
  writeFileSync(envPath, `${next}\n`, 'utf8');
}

async function ensureAuthUser(supabase, password) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-uat-sql-'));
  const filePath = path.join(dir, 'query.sql');
  writeFileSync(filePath, `select id, email from auth.users where email = '${CUSTOMER_EMAIL}' limit 1`, 'utf8');
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
    email: CUSTOMER_EMAIL,
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

  const password = getCustomerPassword();
  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authUser = await ensureAuthUser(supabase, password);

  runSql(`
    insert into public.tgd_user_profiles (id, auth_user_id, email, role, customer_id, is_active)
    values ('${PROFILE_ID}', '${authUser.id}', '${CUSTOMER_EMAIL}', '${CUSTOMER_ROLE}', '${CUSTOMER_ID}', true)
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      role = excluded.role,
      customer_id = excluded.customer_id,
      is_active = true,
      updated_at = now();
  `);

  runSql(`
    insert into public.tgd_customer_products (
      customer_id, customer_product_code, product_name, internal_product_code,
      uom, temperature_type, is_active
    ) values (
      '${CUSTOMER_ID}', '${CATALOG_CODE}', '${CATALOG_NAME}', '${INTERNAL_CODE}',
      'kg', 'FROZEN', true
    )
    on conflict (customer_id, customer_product_code) do update set
      product_name = excluded.product_name,
      internal_product_code = excluded.internal_product_code,
      uom = excluded.uom,
      temperature_type = excluded.temperature_type,
      is_active = true,
      updated_at = now();
  `);

  upsertEnvLocal(password);

  console.log(JSON.stringify({
    ok: true,
    customerEmail: CUSTOMER_EMAIL,
    authUserId: authUser.id,
    profileId: PROFILE_ID,
    customerId: CUSTOMER_ID,
    catalogCode: CATALOG_CODE,
    envUpdated: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

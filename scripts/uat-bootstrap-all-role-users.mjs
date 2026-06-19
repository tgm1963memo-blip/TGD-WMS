import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

const CUSTOMER_ALPHA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const CUSTOMER_BETA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

const ROLE_USERS = [
  {
    email: 'admin.test@tgd-wms.local',
    role: 'admin',
    profileId: '11111111-1111-4111-8111-111111111111',
    customerId: null,
    displayName: 'Demo Admin',
  },
  {
    email: 'manager.test@tgd-wms.local',
    role: 'warehouse_manager',
    profileId: '22222222-2222-4222-8222-222222222222',
    customerId: null,
    displayName: 'Demo Warehouse Manager',
  },
  {
    email: 'warehouse.admin.test@tgd-wms.local',
    role: 'warehouse_admin',
    profileId: '88888888-8888-4888-8888-888888888888',
    customerId: null,
    displayName: 'Demo Warehouse Admin',
  },
  {
    email: 'staff.test@tgd-wms.local',
    role: 'warehouse_staff',
    profileId: '77777777-7777-4777-8777-777777777777',
    customerId: null,
    displayName: 'Demo Warehouse Staff',
  },
  {
    email: 'accounting.test@tgd-wms.local',
    role: 'accounting',
    profileId: '44444444-4444-4444-8444-444444444441',
    customerId: null,
    displayName: 'Demo Accounting',
  },
  {
    email: 'viewer.test@tgd-wms.local',
    role: 'viewer',
    profileId: '55555555-5555-4555-8555-555555555555',
    customerId: null,
    displayName: 'Demo Viewer',
  },
  {
    email: 'customer.admin.test@tgd-wms.local',
    role: 'customer_admin',
    profileId: '66666666-6666-4666-8666-666666666661',
    customerId: CUSTOMER_ALPHA_ID,
    displayName: 'Demo Customer Admin',
  },
  {
    email: 'customer.test@tgd-wms.local',
    role: 'customer_user',
    profileId: '66666666-6666-4666-8666-666666666666',
    customerId: CUSTOMER_ALPHA_ID,
    displayName: 'Demo Customer User',
  },
  {
    email: 'customer.user.testbeta@tgd-wms.local',
    role: 'customer_user',
    profileId: '66666666-6666-4666-8666-666666666662',
    customerId: CUSTOMER_BETA_ID,
    displayName: 'Demo Customer User Beta',
  },
];

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

function getDemoPassword() {
  return process.env.UAT_DEMO_PASSWORD || process.env.UAT_PASSWORD || 'TgdWmsDemo2026!';
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

async function ensureAuthUser(supabase, listedUsers, email, password) {
  const normalized = email.toLowerCase();
  const existing = listedUsers.find((user) => user.email?.toLowerCase() === normalized);
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

async function upsertProfile(user, authUserId) {
  runSql(`
    insert into public.tgd_user_profiles (
      id, auth_user_id, email, role, customer_id, is_active
    ) values (
      ${sqlLiteral(user.profileId)},
      ${sqlLiteral(authUserId)},
      ${sqlLiteral(user.email.toLowerCase())},
      ${sqlLiteral(user.role)},
      ${sqlLiteral(user.customerId)},
      true
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      role = excluded.role,
      customer_id = excluded.customer_id,
      is_active = true,
      updated_at = now();
  `);
}

function writeManifest(password, results) {
  const manifestPath = path.join(ROOT, 'uat-evidence', 'uat-role-test-users.json');
  const dir = path.dirname(manifestPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    environment: 'tgd-wms-staging',
    sharedPasswordHint: 'Use UAT_PASSWORD or UAT_DEMO_PASSWORD from .env.local',
    users: results,
    notes: [
      'Real user thitiwat.tan@tgm.co.th is preserved separately (warehouse_staff).',
      'All demo emails use the same bootstrap password unless overridden.',
    ],
  };

  writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return manifestPath;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('Missing VITE_SUPABASE_URL in .env.local');

  const password = getDemoPassword();
  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rawUsers = runSql(`select id, email from auth.users`);
  const listedUsers = rawUsers?.rows || [];

  const results = [];

  for (const entry of ROLE_USERS) {
    const authUser = await ensureAuthUser(supabase, listedUsers, entry.email, password);
    await upsertProfile(entry, authUser.id);

    const profile = runSql(`
      select id, email, role, customer_id, is_active
      from public.tgd_user_profiles
      where id = ${sqlLiteral(entry.profileId)}
      limit 1;
    `)?.rows?.[0] ?? null;

    results.push({
      email: entry.email.toLowerCase(),
      role: entry.role,
      profileId: entry.profileId,
      authUserId: authUser.id,
      customerId: entry.customerId,
      displayName: entry.displayName,
      profile,
    });
  }

  runSql(`
    insert into public.tgd_customer_products (
      customer_id, customer_product_code, product_name, internal_product_code,
      uom, temperature_type, is_active
    ) values (
      ${sqlLiteral(CUSTOMER_ALPHA_ID)}, 'CUS-FLOW-01', 'Flow Test Product', 'FRZ-FLOW-01',
      'kg', 'FROZEN', true
    )
    on conflict (customer_id, customer_product_code) do update set
      product_name = excluded.product_name,
      internal_product_code = excluded.internal_product_code,
      is_active = true,
      updated_at = now();
  `);

  const manifestPath = writeManifest(password, results);

  console.log(JSON.stringify({
    ok: true,
    userCount: results.length,
    roles: [...new Set(results.map((row) => row.role))],
    manifestPath,
    users: results.map((row) => ({
      email: row.email,
      role: row.role,
      customerId: row.customerId,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

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
  if (!url) throw new Error('Missing VITE_SUPABASE_URL');

  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = 'thitiwat.tan@tgm.co.th';
  const password = process.env.UAT_PASSWORD || 'thitiwat';

  let authUser;
  const { data: listed } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const existing = listed.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    console.log('User already exists in auth, updating password...');
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw error;
    authUser = data.user;
  } else {
    console.log('Creating auth user...');
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    authUser = data.user;
  }

  const profileId = '99999999-9999-4999-8999-999999999999';

  runSql(`
    insert into public.tgd_user_profiles (
      id, auth_user_id, email, role, customer_id, is_active
    ) values (
      '${profileId}', '${authUser.id}', '${email}', 'admin', null, true
    )
    on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      role = 'admin',
      is_active = true,
      updated_at = now();
  `);

  console.log('User thitiwat.tan@tgm.co.th created and profile linked with role: admin.');
}

main().catch(console.error);

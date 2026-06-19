import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function runSql(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-uat-sql-'));
  const filePath = path.join(dir, 'query.sql');
  writeFileSync(filePath, sql, 'utf8');
  execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const users = [
  'admin.demo@tgd-wms.local',
  'manager.demo@tgd-wms.local',
  'warehouse.admin.demo@tgd-wms.local',
  'staff.demo@tgd-wms.local',
  'accounting.demo@tgd-wms.local',
  'viewer.demo@tgd-wms.local',
  'customer.admin.demo@tgd-wms.local',
  'customer.demo@tgd-wms.local',
  'customer.user.beta@tgd-wms.local'
];

for (const email of users) {
  console.log(`Inserting ${email}...`);
  runSql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
    )
    select 
      instance_id, gen_random_uuid(), aud, role, '${email}', encrypted_password, now(), 
      now(), now(), raw_app_meta_data, raw_user_meta_data, false
    from auth.users where email = 'test.admin@tgd-wms.local'
    limit 1;
    
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    select 
      (select id from auth.users where email = '${email}')::text, 
      (select id from auth.users where email = '${email}'), 
      jsonb_build_object('sub', (select id from auth.users where email = '${email}')::text, 'email', '${email}'), 
      'email', now(), now(), now();
  `);
}
console.log("Done inserting auth.users via SQL!");

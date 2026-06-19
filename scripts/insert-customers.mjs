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

runSql(`
  insert into public.tgd_customers (id, customer_code, name, is_active) 
  values 
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'CUS-ALPHA', 'Demo Customer Alpha', true),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'CUS-BETA', 'Demo Customer Beta', true)
  on conflict (id) do update set is_active = true;
`);
console.log("Inserted customers");

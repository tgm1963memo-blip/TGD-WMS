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
  update auth.users 
  set encrypted_password = (select encrypted_password from auth.users where email = 'test.admin@tgd-wms.local')
  where email like '%@tgm.co.th' or email like '%@tgd-wms.local';
`);
console.log("Updated passwords to password123");

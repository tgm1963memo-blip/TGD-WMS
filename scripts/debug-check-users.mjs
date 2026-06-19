import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function runSql(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-uat-sql-'));
  const filePath = path.join(dir, 'query.sql');
  writeFileSync(filePath, sql, 'utf8');
  const raw = execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = raw.indexOf('{');
  return JSON.parse(raw.slice(jsonStart));
}

const users = runSql("select email, encrypted_password from auth.users where email like '%test@%'");
console.log(users.rows);

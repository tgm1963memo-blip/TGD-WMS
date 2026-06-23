import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sql = `
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'tgd_%'
order by table_name;
`;

const dir = mkdtempSync(path.join(tmpdir(), 'tgd-list-'));
const filePath = path.join(dir, 'query.sql');
writeFileSync(filePath, sql, 'utf8');
const raw = execSync(`npx supabase db query --linked -f "${filePath}"`, { encoding: 'utf8' });
console.log(raw);

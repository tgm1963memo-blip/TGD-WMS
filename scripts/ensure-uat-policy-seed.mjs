import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertUatSupabaseUrl, loadUatEnv } from './lib/uatSupabaseAdmin.mjs';

loadUatEnv();
assertUatSupabaseUrl();

const sql = `
insert into public.tgd_customer_request_policy (id)
values (1)
on conflict (id) do nothing;

select id, deposit_cancel_lead_days, withdrawal_cancel_lead_days
from public.tgd_customer_request_policy
where id = 1;
`;

const dir = mkdtempSync(path.join(tmpdir(), 'tgd-policy-seed-'));
const filePath = path.join(dir, 'policy.sql');
writeFileSync(filePath, sql, 'utf8');

const raw = execSync(`npx supabase db query --linked -f "${filePath}"`, { encoding: 'utf8' });
const jsonStart = raw.indexOf('{');
const payload = jsonStart >= 0 ? JSON.parse(raw.slice(jsonStart)) : null;
const row = payload?.rows?.[0] ?? null;

console.log(JSON.stringify({
  ok: Boolean(row),
  policy: row,
}, null, 2));

if (!row) process.exit(1);

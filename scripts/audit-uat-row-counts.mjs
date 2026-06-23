import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const UAT_PROJECT_REF = 'lievvsqbosvrolkrftna';
const url = (process.env.VITE_SUPABASE_URL || '').trim();
if (!url.includes(UAT_PROJECT_REF)) {
  console.error(`Refusing audit: not UAT (${UAT_PROJECT_REF})`);
  process.exit(1);
}

const sql = `
select 'user_profiles' as tbl, count(*)::int as cnt from public.tgd_user_profiles
union all select 'customers', count(*)::int from public.tgd_customers
union all select 'customer_products', count(*)::int from public.tgd_customer_products
union all select 'deposit_requests', count(*)::int from public.tgd_customer_deposit_requests
union all select 'withdrawal_requests', count(*)::int from public.tgd_customer_withdrawal_requests
union all select 'receiving_documents', count(*)::int from public.tgd_receiving_documents
union all select 'stock_movements', count(*)::int from public.tgd_stock_movements
union all select 'stock_balances', count(*)::int from public.tgd_stock_balances
order by 1;
`;

const dir = mkdtempSync(path.join(tmpdir(), 'tgd-audit-'));
const filePath = path.join(dir, 'audit.sql');
writeFileSync(filePath, sql, 'utf8');
const raw = execSync(`npx supabase db query --linked -f "${filePath}"`, { encoding: 'utf8' });
const i = raw.indexOf('{');
console.log(JSON.stringify(i >= 0 ? JSON.parse(raw.slice(i)) : { raw }, null, 2));

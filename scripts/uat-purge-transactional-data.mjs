import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const sqlPath = path.join(ROOT, 'database/scripts/047_uat_transactional_data_reset.sql');

function runSqlFile(filePath) {
  execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function countRows(table) {
  const raw = execSync(
    `npx supabase db query --linked "select count(*)::int as count from public.${table};"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) return null;
  const payload = JSON.parse(raw.slice(jsonStart));
  return payload.rows?.[0]?.count ?? null;
}

console.log('Purging UAT transactional data...');
runSqlFile(sqlPath);

const checks = [
  'tgd_customer_deposit_requests',
  'tgd_customer_withdrawal_requests',
  'tgd_receiving_documents',
  'tgd_stock_balances',
  'tgd_stock_movements',
  'tgd_billing_invoice_drafts',
];

const summary = Object.fromEntries(checks.map((table) => [table, countRows(table)]));
console.log(JSON.stringify({ ok: true, remainingRows: summary }, null, 2));

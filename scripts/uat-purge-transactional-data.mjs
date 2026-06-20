import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

// Transactional tables in deletion order (children before parents).
const TRANSACTIONAL_TABLES = [
  'tgd_customer_document_timeline_events',
  'tgd_customer_document_attachments',
  'tgd_customer_deposit_request_lines',
  'tgd_customer_withdrawal_request_lines',
  'tgd_customer_deposit_receiving_links',
  'tgd_customer_withdrawal_execution_links',
  'tgd_customer_deposit_requests',
  'tgd_customer_withdrawal_requests',
  'tgd_customer_products',
  'tgd_dispatch_lines',
  'tgd_dispatch_documents',
  'tgd_picking_tasks',
  'tgd_picking_documents',
  'tgd_outbound_lines',
  'tgd_outbound_reservations',
  'tgd_outbound_documents',
  'tgd_allocation_records',
  'tgd_withdrawal_request_lines',
  'tgd_withdrawal_requests',
  'tgd_putaway_tasks',
  'tgd_receiving_lines',
  'tgd_receiving_documents',
  'tgd_transfer_lines',
  'tgd_transfer_documents',
  'tgd_adjustment_lines',
  'tgd_adjustment_documents',
  'tgd_stock_count_lines',
  'tgd_stock_count_sessions',
  'tgd_stock_movements',
  'tgd_stock_balances',
  'tgd_billing_invoice_draft_lines',
  'tgd_billing_invoice_drafts',
  'tgd_accounting_charge_staging',
  'tgd_operation_charges',
  'tgd_monthly_storage_snapshots',
];

function getServiceRoleKey() {
  // Use tmpdir() as cwd — the Supabase CLI cannot spawn from a Thai-char path on Windows.
  const raw = execSync(
    'npx supabase projects api-keys --project-ref lievvsqbosvrolkrftna',
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: tmpdir() },
  );
  const idx = raw.indexOf('{');
  if (idx < 0) throw new Error('Unable to parse Supabase API keys output');
  const payload = JSON.parse(raw.slice(idx));
  const key = payload.keys?.find((r) => r.name === 'service_role')?.api_key;
  if (!key) throw new Error('service_role key not found');
  return key;
}

async function deleteAllRows(supabase, tableName) {
  const { error } = await supabase.from(tableName).delete().not('id', 'is', null);
  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to delete from ${tableName}: ${error.message}`);
  }
}

async function countRows(supabase, tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  if (error) return '?';
  return count ?? 0;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('Missing VITE_SUPABASE_URL in .env.local');

  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Purging UAT transactional data...');
  for (const table of TRANSACTIONAL_TABLES) {
    await deleteAllRows(supabase, table);
  }

  const checks = [
    'tgd_customer_deposit_requests',
    'tgd_customer_withdrawal_requests',
    'tgd_receiving_documents',
    'tgd_stock_balances',
    'tgd_stock_movements',
    'tgd_billing_invoice_drafts',
  ];

  const remainingRows = {};
  for (const t of checks) {
    remainingRows[t] = await countRows(supabase, t);
  }

  console.log(JSON.stringify({ ok: true, remainingRows }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

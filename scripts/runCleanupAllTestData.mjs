/**
 * Cleanup all test data from Supabase (Level C).
 * Keeps only: thitiwat.tan@tgm.co.th user profile.
 * Run auth purge separately: node scripts/purge-all-test-data.mjs (step 4 only after DB cleanup)
 *
 * Usage: node scripts/runCleanupAllTestData.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { assertUatSupabaseUrl, resolveServiceRoleKey } from './lib/uatSupabaseAdmin.mjs';

dotenv.config({ path: '.env.local' });
assertUatSupabaseUrl();

const KEEP_EMAIL = 'thitiwat.tan@tgm.co.th';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  resolveServiceRoleKey().key,
  { auth: { persistSession: false } },
);

async function deleteAll(table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .not('id', 'is', null);

  if (error) {
    console.error(`  ❌ ${table}: ${error.message}`);
  } else {
    console.log(`  ✓  ${table}: deleted ${count ?? '?'} rows`);
  }
}

async function main() {
  console.log('=== TGD WMS — Cleanup All Test Data ===\n');

  // 1. Handheld
  console.log('1. Handheld sessions');
  await deleteAll('tgd_handheld_picking_scans');
  await deleteAll('tgd_handheld_picking_sessions');
  await deleteAll('tgd_handheld_putaway_scans');
  await deleteAll('tgd_handheld_putaway_sessions');
  await deleteAll('tgd_handheld_receiving_scans');
  await deleteAll('tgd_handheld_receiving_sessions');

  // 2. Billing
  console.log('\n2. Billing');
  await deleteAll('tgd_billing_invoice_draft_lines');
  await deleteAll('tgd_billing_invoice_drafts');
  await deleteAll('tgd_accounting_charge_staging');
  await deleteAll('tgd_monthly_storage_snapshots');
  await deleteAll('tgd_operation_charges');

  // 3. Customer portal — notifications
  console.log('\n3. Customer portal notifications');
  await deleteAll('tgd_customer_request_email_queue');
  await deleteAll('tgd_customer_document_timeline_events');
  await deleteAll('tgd_customer_document_attachments');

  // 4. Customer portal — withdrawal
  console.log('\n4. Customer withdrawal');
  await deleteAll('tgd_customer_withdrawal_execution_links');
  await deleteAll('tgd_customer_withdrawal_request_lines');
  await deleteAll('tgd_customer_withdrawal_requests');

  // 5. Customer portal — deposit & facility
  console.log('\n5. Customer deposit & facility');
  await deleteAll('tgd_customer_facility_usage_requests');
  await deleteAll('tgd_customer_deposit_receiving_links');
  await deleteAll('tgd_customer_deposit_request_lines');
  await deleteAll('tgd_customer_deposit_requests');

  // 6. Operations — outbound
  console.log('\n6. Operations outbound');
  await deleteAll('tgd_dispatch_lines');
  await deleteAll('tgd_dispatch_documents');
  await deleteAll('tgd_picking_tasks');
  await deleteAll('tgd_allocation_records');
  await deleteAll('tgd_withdrawal_request_lines');
  await deleteAll('tgd_withdrawal_requests');

  // 7. Operations — inbound
  console.log('\n7. Operations inbound');
  await deleteAll('tgd_receiving_lines');
  await deleteAll('tgd_receiving_documents');
  await deleteAll('tgd_putaway_tasks');

  // 8. Transfer / adjustment / stock count
  console.log('\n8. Transfer / adjustment / stock count');
  await deleteAll('tgd_transfer_lines');
  await deleteAll('tgd_transfer_documents');
  await deleteAll('tgd_adjustment_lines');
  await deleteAll('tgd_adjustment_documents');
  await deleteAll('tgd_stock_count_lines');
  await deleteAll('tgd_stock_count_sessions');

  // 9. Stock
  console.log('\n9. Stock');
  await deleteAll('tgd_stock_balances');
  await deleteAll('tgd_stock_movements');
  await deleteAll('tgd_lots');
  await deleteAll('tgd_pallets');

  // 10. Audit logs
  console.log('\n10. Audit logs');
  await deleteAll('tgd_audit_logs');

  // 11. Customer catalog products
  console.log('\n11. Customer products');
  await deleteAll('tgd_customer_products');

  // 12. Customer config
  console.log('\n12. Customer config');
  await deleteAll('tgd_customer_storage_rate_rules');
  await deleteAll('tgd_customer_request_policy');

  // 13. User profiles — keep thitiwat.tan@tgm.co.th
  console.log('\n13. User profiles (keep thitiwat.tan@tgm.co.th)');
  const { error: upErr, count: upCount } = await supabase
    .from('tgd_user_profiles')
    .delete({ count: 'exact' })
    .neq('email', 'thitiwat.tan@tgm.co.th');

  if (upErr) {
    console.error(`  ❌ tgd_user_profiles: ${upErr.message}`);
  } else {
    console.log(`  ✓  tgd_user_profiles: deleted ${upCount ?? '?'} rows`);
  }

  // 14. Customers
  console.log('\n14. Customers');
  await deleteAll('tgd_customers');

  // Verify
  console.log('\n=== Verification ===');
  const checks = [
    ['tgd_user_profiles', null],
    ['tgd_customers', null],
    ['tgd_customer_products', null],
    ['tgd_customer_deposit_requests', null],
    ['tgd_customer_withdrawal_requests', null],
    ['tgd_receiving_documents', null],
    ['tgd_stock_movements', null],
    ['tgd_stock_balances', null],
  ];

  for (const [table] of checks) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ${table}: ERROR — ${error.message}`);
    } else {
      const icon = count === 0 ? '✓' : '⚠';
      console.log(`  ${icon}  ${table}: ${count} rows remaining`);
    }
  }

  console.log('\n✅ Done. Remember to delete auth users from Supabase Dashboard → Authentication → Users.');
  console.log('   Keep only: thitiwat.tan@tgm.co.th');
  console.log('\nNext: npm run uat:restore-environment');
}

main().catch(console.error);

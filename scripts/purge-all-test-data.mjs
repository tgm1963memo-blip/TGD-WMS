/**
 * Full test data purge — keeps only thitiwat.tan@tgm.co.th.
 *
 * Uses the Supabase JS client for all database operations (no CLI needed)
 * because the Supabase CLI cannot spawn from a CWD with Thai characters on Windows.
 *
 * Deletes:
 *   1. All transactional data (individual table deletes via JS client)
 *   2. Demo user profiles  (all @tgd-wms.local emails)
 *   3. Demo customers      (known UUIDs from bootstrap)
 *   4. Demo auth users     (Supabase Auth admin API)
 */

import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import dotenv from 'dotenv';
import { resolveServiceRoleKey } from './lib/uatSupabaseAdmin.mjs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const DEMO_CUSTOMER_IDS = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
];
const KEEP_EMAIL = 'thitiwat.tan@tgm.co.th';
const TEST_EMAIL_SUFFIX = '@tgd-wms.local';

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
  return resolveServiceRoleKey().key;
}

async function deleteAllRows(supabase, tableName) {
  // .not('id', 'is', null) generates WHERE id IS NOT NULL — matches every row.
  // With the service role key, RLS is bypassed so this clears the whole table.
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

  console.log('Fetching service role key...');
  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Step 1: Transactional data ──────────────────────────────────────────────
  console.log('\n[1/4] Purging transactional data...');
  for (const table of TRANSACTIONAL_TABLES) {
    process.stdout.write(`      ${table}... `);
    await deleteAllRows(supabase, table);
    process.stdout.write('done\n');
  }

  // ── Step 2: Demo user profiles ──────────────────────────────────────────────
  console.log('\n[2/4] Deleting demo user profiles (@tgd-wms.local)...');
  const { data: deletedProfiles, error: profileErr } = await supabase
    .from('tgd_user_profiles')
    .delete()
    .ilike('email', `%${TEST_EMAIL_SUFFIX}`)
    .neq('email', KEEP_EMAIL)
    .select('id, email, role');
  if (profileErr) throw new Error(`Profile delete failed: ${profileErr.message}`);
  console.log(`      Deleted ${deletedProfiles?.length ?? 0} profile(s):`);
  (deletedProfiles ?? []).forEach((r) => console.log(`        - ${r.email} (${r.role})`));

  // ── Step 3: Demo customers ──────────────────────────────────────────────────
  console.log('\n[3/4] Deleting demo customers...');

  // Tables that FK-reference tgd_customers and weren't in the transactional list.
  // Must be cleared before deleting the customer rows.
  const customerChildTables = [
    'tgd_customer_request_email_queue',
    'tgd_customer_facility_usage_requests',
    'tgd_customer_storage_rate_rules',
    'tgd_lots',
    'tgd_pallets',
  ];
  for (const t of customerChildTables) {
    process.stdout.write(`      Clearing ${t}... `);
    const { error } = await supabase
      .from(t)
      .delete()
      .in('customer_id', DEMO_CUSTOMER_IDS);
    if (error && !error.message.includes('does not exist') && !error.message.includes('column "customer_id"')) {
      console.warn(`WARN: ${error.message}`);
    } else {
      process.stdout.write('done\n');
    }
  }

  const { data: deletedCustomers, error: custErr } = await supabase
    .from('tgd_customers')
    .delete()
    .in('id', DEMO_CUSTOMER_IDS)
    .select('id, customer_name');
  if (custErr) throw new Error(`Customer delete failed: ${custErr.message}`);
  console.log(`      Deleted ${deletedCustomers?.length ?? 0} customer(s):`);
  (deletedCustomers ?? []).forEach((r) => console.log(`        - ${r.customer_name ?? r.id}`));

  // ── Step 4: Demo auth users ─────────────────────────────────────────────────
  console.log('\n[4/4] Deleting demo auth users from Supabase Auth...');
  const DEMO_AUTH_EMAILS = [
    'admin.test@tgd-wms.local',
    'manager.test@tgd-wms.local',
    'warehouse.admin.test@tgd-wms.local',
    'staff.test@tgd-wms.local',
    'accounting.test@tgd-wms.local',
    'viewer.test@tgd-wms.local',
    'customer.admin.test@tgd-wms.local',
    'customer.test@tgd-wms.local',
    'customer.user.testbeta@tgd-wms.local',
    // Extra demo accounts found during initial profile delete
    'accounting.demo@tgd-wms.local',
    'viewer.demo@tgd-wms.local',
    'customer.admin.demo@tgd-wms.local',
    'customer.user.beta@tgd-wms.local',
  ];

  // List auth users with small page size to avoid 500 timeout on large result sets
  const authApiUrl = url.replace(/\/$/, '');
  const serviceRoleKey = getServiceRoleKey();
  const authHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

  const toDelete = [];
  let page = 1;
  const PER_PAGE = 1;
  while (true) {
    const listRes = await fetch(`${authApiUrl}/auth/v1/admin/users?per_page=${PER_PAGE}&page=${page}`, {
      headers: authHeaders,
    });
    if (!listRes.ok) {
      const body = await listRes.text();
      console.warn(`      WARN: Auth list stopped at page ${page} (${listRes.status}) — proceeding with collected users`);
      break;
    }
    const listJson = await listRes.json();
    const pageUsers = listJson.users ?? listJson ?? [];
    if (pageUsers.length === 0) break;
    pageUsers.forEach((u) => {
      if (DEMO_AUTH_EMAILS.includes(u.email?.toLowerCase())) toDelete.push(u);
    });
    if (pageUsers.length < PER_PAGE) break;
    page++;
  }

  let deletedAuth = 0;
  let skippedAuth = DEMO_AUTH_EMAILS.length - toDelete.length;
  for (const user of toDelete) {
    const delRes = await fetch(`${authApiUrl}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!delRes.ok) {
      console.warn(`      WARN: Failed to delete ${user.email}: ${delRes.status}`);
    } else {
      console.log(`        - Deleted: ${user.email}`);
      deletedAuth++;
    }
  }
  console.log(`      Deleted ${deletedAuth}, skipped/not-found ${skippedAuth}.`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n── Post-purge row counts ───────────────────────────────────────');
  const checkTables = [
    'tgd_customer_deposit_requests',
    'tgd_customer_withdrawal_requests',
    'tgd_stock_balances',
    'tgd_stock_movements',
    'tgd_billing_invoice_drafts',
    'tgd_user_profiles',
    'tgd_customers',
  ];
  for (const t of checkTables) {
    const c = await countRows(supabase, t);
    console.log(`  ${t}: ${c}`);
  }

  // Confirm keeper still exists
  const { data: keeper } = await supabase
    .from('tgd_user_profiles')
    .select('id, email, role, is_active')
    .eq('email', KEEP_EMAIL)
    .single();

  if (keeper) {
    console.log(`\n✓ Keeper preserved: ${keeper.email} (${keeper.role}, active=${keeper.is_active})`);
  } else {
    console.warn(`\n⚠ WARNING: Keeper user ${KEEP_EMAIL} not found in tgd_user_profiles!`);
  }

  console.log('\nPurge complete.\n');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});

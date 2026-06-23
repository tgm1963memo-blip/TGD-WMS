/**
 * Validates FK constraints, demo seed data (067), and PostgREST nested selects
 * used by application services.
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { resolveServiceRoleKey } from './lib/uatSupabaseAdmin.mjs';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

function runSql(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-verify-'));
  const filePath = path.join(dir, 'query.sql');
  writeFileSync(filePath, sql, 'utf8');
  const raw = execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) return null;
  return JSON.parse(raw.slice(jsonStart));
}

function getServiceRoleKey() {
  return resolveServiceRoleKey().key;
}

const NESTED_SELECTS = [
  // Inbound (customer deposit driven)
  { label: 'receiving documents + lines', table: 'tgd_receiving_documents', select: '*, tgd_receiving_lines(*)' },
  { label: 'customer deposit request + lines', table: 'tgd_customer_deposit_requests', select: 'id, tgd_customer_deposit_request_lines(id, line_no, customer_product_code)' },
  // Outbound
  { label: 'withdrawal request + lines', table: 'tgd_withdrawal_requests', select: '*, tgd_withdrawal_request_lines(*)' },
  { label: 'customer withdrawal request + lines', table: 'tgd_customer_withdrawal_requests', select: 'id, tgd_customer_withdrawal_request_lines(id, line_no)' },
  // Master / layout
  { label: 'zones → rooms → locations', table: 'tgd_zones', select: 'id, zone_code, tgd_rooms(id, tgd_locations(id, location_code))' },
  { label: 'customer products catalog', table: 'tgd_customer_products', select: 'id, customer_product_code, product_name, customer_id, internal_product_id' },
  { label: 'product service rates → customer products', table: 'tgd_customer_product_service_rates', select: 'id, tgd_customer_products!inner(id, customer_product_code, product_name, customer_id)' },
  // Billing / reporting
  { label: 'billing invoice drafts + lines', table: 'tgd_billing_invoice_drafts', select: 'id, tgd_billing_invoice_draft_lines(id, invoice_draft_id)', optional: true },
  // Handheld (optional — tables may not exist on all DB instances)
  { label: 'handheld receiving + scans', table: 'tgd_handheld_receiving_sessions', select: '*, tgd_handheld_receiving_scans(*)', optional: true },
  { label: 'barcode scan events', table: 'tgd_barcode_scan_events', select: 'id, scan_type, barcode_value', optional: true },
];

const REQUIRED_FKS = [
  'fk_stock_balances_location_id',
  'fk_stock_balances_customer_id',
  'fk_stock_balances_product_id',
  'fk_stock_balances_lot_id',
  'fk_stock_movements_customer_id',
  'fk_stock_movements_product_id',
  'fk_stock_movements_lot_id',
];

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('Missing VITE_SUPABASE_URL');

  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = { ok: true, checks: [] };

  // 1. Demo seed (067)
  const seedSql = `
    select
      (select count(*)::int from public.tgd_customers
        where name = 'Demo Customer Alpha' or customer_name = 'Demo Customer Alpha') as demo_customer_count,
      (select count(*)::int from public.tgd_products where sku = 'FRZ-FLOW-01') as demo_product_count,
      (select count(*)::int
         from public.tgd_customer_products cp
         join public.tgd_customers c on c.id = cp.customer_id
         join public.tgd_products p on p.id = cp.internal_product_id
        where cp.customer_product_code = 'CUS-FLOW-01'
          and p.sku = 'FRZ-FLOW-01'
          and (c.name = 'Demo Customer Alpha' or c.customer_name = 'Demo Customer Alpha')
      ) as demo_catalog_count,
      (select count(*)::int
         from public.tgd_customer_products cp
        where cp.customer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
          and cp.customer_product_code = 'CUS-FLOW-01'
      ) as bootstrap_catalog_count,
      (select count(*)::int
         from public.tgd_customer_products cp
         join public.tgd_user_profiles up on up.customer_id = cp.customer_id
        where up.email like 'customer.%@tgd-wms.local'
          and cp.customer_product_code = 'CUS-FLOW-01'
      ) as uat_customer_catalog_count;
  `;
  const seedResult = runSql(seedSql);
  const seedRow = seedResult?.result?.[0] ?? seedResult?.rows?.[0] ?? {};
  const seedOk = Number(seedRow.demo_customer_count) >= 1
    && Number(seedRow.demo_product_count) >= 1
    && Number(seedRow.demo_catalog_count) >= 1;
  results.checks.push({
    name: '067 demo seed linkage',
    ok: seedOk,
    detail: seedRow,
  });
  const catalogOk = Number(seedRow.bootstrap_catalog_count) >= 1
    || Number(seedRow.uat_customer_catalog_count) >= 1
    || Number(seedRow.demo_catalog_count) >= 1;
  results.checks.push({
    name: 'UAT customer catalog (067)',
    ok: catalogOk,
    detail: {
      bootstrap_catalog_count: seedRow.bootstrap_catalog_count,
      uat_customer_catalog_count: seedRow.uat_customer_catalog_count,
    },
  });
  if (!catalogOk) results.ok = false;

  // 2. FK constraints from migration 065
  const fkSql = `
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name = any(array[${REQUIRED_FKS.map((n) => `'${n}'`).join(',')}]);
  `;
  const fkResult = runSql(fkSql);
  const fkRows = fkResult?.result ?? fkResult?.rows ?? [];
  const foundFks = fkRows.map((r) => r.constraint_name);
  const missingFks = REQUIRED_FKS.filter((n) => !foundFks.includes(n));
  results.checks.push({
    name: 'FK constraints (065)',
    ok: missingFks.length === 0,
    detail: { found: foundFks, missing: missingFks },
  });
  if (missingFks.length) results.ok = false;

  // 2b. Deposit ↔ receiving link integrity (068)
  const linkSql = `
    select
      (select count(*)::int from public.tgd_receiving_documents
        where source_customer_deposit_request_id is not null) as receiving_with_cdr_source,
      (select count(*)::int from public.tgd_customer_deposit_receiving_links) as link_rows,
      (select count(*)::int
         from public.tgd_receiving_documents rd
        where rd.source_customer_deposit_request_id is not null
          and not exists (
            select 1 from public.tgd_customer_deposit_receiving_links l
            where l.receiving_document_id = rd.id
          )
      ) as receiving_missing_link;
  `;
  const linkResult = runSql(linkSql);
  const linkRow = linkResult?.result?.[0] ?? linkResult?.rows?.[0] ?? {};
  const linkOk = Number(linkRow.receiving_missing_link) === 0;
  results.checks.push({
    name: 'deposit ↔ receiving link integrity (068)',
    ok: linkOk,
    detail: linkRow,
  });
  if (!linkOk) results.ok = false;

  // 2c. Core table readability (active menu functions)
  const CORE_TABLES = [
    'tgd_customers', 'tgd_products', 'tgd_warehouses', 'tgd_locations',
    'tgd_stock_balances', 'tgd_stock_movements', 'tgd_lots',
    'tgd_user_profiles', 'tgd_customer_request_policy',
    'tgd_customer_facility_usage_requests', 'tgd_customer_storage_rate_rules',
  ];
  for (const tableName of CORE_TABLES) {
    const { error } = await supabase.from(tableName).select('*').limit(1);
    results.checks.push({
      name: `table readable: ${tableName}`,
      ok: !error,
      detail: error ? error.message : 'ok',
    });
    if (error) results.ok = false;
  }

  // 3. PostgREST nested selects
  for (const probe of NESTED_SELECTS) {
    const { error } = await supabase.from(probe.table).select(probe.select).limit(1);
    const missingTable = error?.message?.includes('Could not find the table');
    const missingRelationship = error?.message?.includes('Could not find a relationship');
    const checkOk = !error;
    const skipped = probe.optional && (missingTable || missingRelationship);

    results.checks.push({
      name: `nested select: ${probe.label}`,
      ok: checkOk || skipped,
      skipped: skipped || false,
      detail: error ? error.message : 'ok',
    });
    if (!checkOk && !skipped) results.ok = false;
  }

  // 4. Billing / movement views
  for (const viewName of ['tgd_unified_movements_v', 'tgd_billing_movement_weight_v']) {
    const { error } = await supabase.from(viewName).select('*').limit(1);
    results.checks.push({
      name: `view readable: ${viewName}`,
      ok: !error,
      detail: error ? error.message : 'ok',
    });
    if (error) results.ok = false;
  }

  console.log(JSON.stringify(results, null, 2));
  process.exit(results.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

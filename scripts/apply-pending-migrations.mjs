import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();

const MIGRATIONS = [
  '053_tgd_wms_customer_request_policy.sql',
  '054_tgd_wms_item_master_and_request_line_extensions.sql',
  '055_tgd_wms_customer_request_execution_bridge.sql',
  '056_tgd_wms_facility_usage_and_storage_rate_rules.sql',
  '057_tgd_wms_deposit_pack_size_vehicle_and_notifications.sql',
  '058_tgd_wms_confirm_deposit_receiving.sql',
  '058_tgd_wms_customer_product_allergen_weight.sql',
  '059_tgd_wms_deposit_line_actual_receipt.sql',
  '060_tgd_wms_customer_columns_backfill.sql',
  '061_tgd_wms_handheld_pin_login.sql',
  '062_tgd_wms_withdrawal_lines_lot_no.sql',
  '063_tgd_wms_handheld_staff_list_and_pin_reuse.sql',
  '064_tgd_wms_deposit_line_location_lot.sql',
  '065_tgd_wms_schema_relationship_and_rls_fixes.sql',
  '066_tgd_wms_product_service_rates_foundation.sql',
  '067_tgd_wms_demo_customer_seed.sql',
  '068_tgd_wms_deprecate_standalone_receiving_draft.sql',
  '069_tgd_wms_role_area_permissions.sql',
  '070_tgd_wms_role_function_permissions.sql',
  '071_tgd_wms_withdrawal_review_send_to_picking.sql',
  '072_tgd_wms_confirm_receipt_creates_stock_movements.sql',
  '074_backfill_stock_balances_from_deposit_lines.sql',
  '075_fix_stock_balance_quantity_column.sql',
  '076_tgd_wms_customer_request_proxy_and_signatures.sql',
  '077_add_count_variance_decision_to_deposit_review.sql',
  '078_fix_stock_balance_occupancy_backfill.sql',
  '079_fix_withdrawal_draft_submission.sql',
  '080_patch_withdrawal_drafts.sql',
  '081_sync_stock_balances_on_withdrawal_confirm.sql',
];

function runSql(sql, label) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tgd-migration-'));
  const filePath = path.join(dir, `${label}.sql`);
  writeFileSync(filePath, sql, 'utf8');
  console.log(`Applying ${label}...`);
  execSync(`npx supabase db query --linked -f "${filePath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log(`Applied ${label}`);
}

function main() {
  for (const fileName of MIGRATIONS) {
    const filePath = path.join(ROOT, 'database', 'migrations', fileName);
    const sql = readFileSync(filePath, 'utf8');
    runSql(sql, fileName.replace('.sql', ''));
  }
  console.log(JSON.stringify({ ok: true, applied: MIGRATIONS }, null, 2));
}

main();

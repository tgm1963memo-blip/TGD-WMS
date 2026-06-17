import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration055 = path.join(process.cwd(), 'database/migrations/055_tgd_wms_customer_request_execution_bridge.sql');
const migration056 = path.join(process.cwd(), 'database/migrations/056_tgd_wms_facility_usage_and_storage_rate_rules.sql');

function read(filePath) {
  return readFileSync(filePath, 'utf8');
}

describe('055 customer request execution bridge', () => {
  it('creates migration 055', () => {
    expect(existsSync(migration055)).toBe(true);
  });

  it('defines deposit and withdrawal bridge functions', () => {
    const sql = read(migration055);
    expect(sql).toContain('tgd_bridge_customer_deposit_to_receiving');
    expect(sql).toContain('tgd_bridge_customer_withdrawal_to_internal');
    expect(sql).toContain('tgd_customer_deposit_receiving_links');
    expect(sql).toContain('tgd_customer_withdrawal_execution_links');
  });

  it('extends review RPCs to invoke bridge on ACCEPT', () => {
    const sql = read(migration055);
    expect(sql).toContain("if v_decision = 'ACCEPT' then");
    expect(sql).toContain('receiving_document_id');
    expect(sql).toContain('internal_withdrawal_request_id');
  });
});

describe('056 facility usage and storage rate rules', () => {
  it('creates migration 056', () => {
    expect(existsSync(migration056)).toBe(true);
  });

  it('defines facility usage table and RPCs', () => {
    const sql = read(migration056);
    expect(sql).toContain('tgd_customer_facility_usage_requests');
    expect(sql).toContain('tgd_create_customer_facility_usage_request');
    expect(sql).toContain('tgd_submit_customer_facility_usage_request');
  });

  it('defines storage rate rules by charge basis', () => {
    const sql = read(migration056);
    expect(sql).toContain('tgd_customer_storage_rate_rules');
    expect(sql).toContain('tgd_upsert_customer_storage_rate_rule');
    expect(sql).toContain("'WEIGHT', 'PALLET'");
  });
});

describe('056 frontend wiring', () => {
  it('exposes facility usage page and storage rate admin', () => {
    expect(existsSync(path.join(process.cwd(), 'src/features/customer/CustomerFacilityUsageRequestPage.jsx'))).toBe(true);
    expect(existsSync(path.join(process.cwd(), 'src/features/admin/CustomerStorageRateRulesAdminPage.jsx'))).toBe(true);
    expect(existsSync(path.join(process.cwd(), 'src/components/customer/CustomerDepositStaffWorkOrderPrint.jsx'))).toBe(true);
  });
});

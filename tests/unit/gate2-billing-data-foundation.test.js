import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BILLING_EXCLUSION_REASONS,
  BILLING_SERVICE_TYPES,
  resolveBillingEligibility,
} from '../../src/constants/movementTypeMapping.js';
import {
  assertMigrationApplyAllowed,
  classifySupabaseEnvironment,
  maskSupabaseProjectRef,
} from '../../src/config/supabaseEnvironmentGuard.js';
import {
  BILLING_MOVEMENT_WEIGHT_VIEW_NAME,
  shapeBillingMovementWeightRow,
} from '../../src/services/billingMovementWeightService.js';
import { normalizeStockMovementRow } from '../../src/services/unifiedMovementReadService.js';
import { resolveMovementWeights } from '../../src/utils/billingWeightUtils.js';

describe('Gate 2 billing data foundation', () => {
  it('classifies unknown environment as not safe for migration apply', () => {
    const status = classifySupabaseEnvironment({
      supabaseUrl: 'https://lievvsqbosvrolkrftna.supabase.co',
      appEnv: 'development',
    });

    expect(status.classification).toBe('unknown');
    expect(status.canApplyMigration).toBe(false);
    expect(() => assertMigrationApplyAllowed(status)).toThrow(/BLOCKED/i);
  });

  it('allows migration apply only for explicit uat/dev/staging labels', () => {
    expect(classifySupabaseEnvironment({ appEnv: 'uat' }).canApplyMigration).toBe(true);
    expect(classifySupabaseEnvironment({ appEnv: 'staging' }).canApplyMigration).toBe(true);
    expect(classifySupabaseEnvironment({ appEnv: 'production' }).canApplyMigration).toBe(false);
  });

  it('masks supabase project ref for reporting', () => {
    expect(maskSupabaseProjectRef('https://lievvsqbosvrolkrftna.supabase.co')).toBe('lievvsqbosvrolkrftna');
  });

  it('marks RECEIVE_CONFIRM as billable inbound handling', () => {
    const row = normalizeStockMovementRow({
      id: 'mv-1',
      movement_type: 'RECEIVE_CONFIRM',
      customer_id: 'cust-1',
      product_id: 'prod-1',
      quantity: 10,
      weight: 100,
      source_module: 'RECEIVING',
      source_document_id: 'doc-1',
    });

    expect(row.is_billable).toBe(true);
    expect(row.billing_service_type).toBe(BILLING_SERVICE_TYPES.INBOUND_HANDLING);
    expect(row.billing_exclusion_reason).toBeNull();
  });

  it('excludes PUTAWAY and PICK_ALLOCATE conservatively', () => {
    const putaway = resolveBillingEligibility({ movement_type_raw: 'PUTAWAY_CONFIRM', source_document_id: 'x' });
    const allocate = resolveBillingEligibility({ movement_type_raw: 'PICK_ALLOCATE', reference_id: 'x' });

    expect(putaway.is_billable).toBe(false);
    expect(allocate.is_billable).toBe(false);
  });

  it('excludes PICK_CONFIRM unless final dispatch raw type', () => {
    const pickOnly = resolveBillingEligibility({
      movement_type_raw: 'PICK_CONFIRM',
      source_document_id: 'doc-1',
    });
    const dispatch = resolveBillingEligibility({
      movement_type_raw: 'DISPATCH_CONFIRM',
      source_document_id: 'doc-2',
    });

    expect(pickOnly.billing_exclusion_reason).toBe(BILLING_EXCLUSION_REASONS.PICK_NOT_FINAL_DISPATCH);
    expect(dispatch.is_billable).toBe(true);
    expect(dispatch.billing_service_type).toBe(BILLING_SERVICE_TYPES.OUTBOUND_HANDLING);
  });

  it('excludes TRANSFER in first version', () => {
    const transfer = resolveBillingEligibility({
      movement_type_raw: 'TRANSFER_CONFIRM',
      source_document_id: 'doc-3',
    });

    expect(transfer.is_billable).toBe(false);
    expect(transfer.billing_exclusion_reason).toBe(BILLING_EXCLUSION_REASONS.TRANSFER_NOT_CONFIGURED);
  });

  it('excludes draft movements from billing source', () => {
    const draft = resolveBillingEligibility({
      movement_type_raw: 'RECEIVE',
      reference_type: 'RECEIVING_DRAFT',
      reference_id: 'draft-1',
    });

    expect(draft.is_billable).toBe(false);
    expect(draft.billing_exclusion_reason).toBe(BILLING_EXCLUSION_REASONS.DRAFT_MOVEMENT);
  });

  it('falls back chargeable weight from qty and weight_per_unit', () => {
    const weights = resolveMovementWeights(
      { qty: 4, weight: 0 },
      { product: { weight_kg: 2.5 } },
    );

    expect(weights.gross_weight).toBe(10);
    expect(weights.chargeable_weight).toBe(10);
    expect(weights.billing_status).toBe('READY_FOR_PREVIEW');
  });

  it('shapes billing movement weight row with required fields', () => {
    const shaped = shapeBillingMovementWeightRow(normalizeStockMovementRow({
      id: 'mv-2',
      movement_type: 'RECEIVE_CONFIRM',
      customer_id: 'cust-1',
      product_id: 'prod-1',
      quantity: 3,
      weight: 30,
      source_module: 'RECEIVING',
      source_document_id: 'doc-9',
      source_document_no: 'RCV-001',
    }));

    expect(shaped.movement_id).toBe('mv-2');
    expect(shaped.canonical_movement_type).toBe('RECEIVE');
    expect(shaped.source_document_no).toBe('RCV-001');
    expect(shaped.is_billable).toBe(true);
    expect(shaped.chargeable_weight).toBeGreaterThan(0);
  });

  it('includes gate 2 migration drafts with billing fields and no destructive SQL', () => {
    const files = [
      '034_tgd_wms_unified_movement_read_view.sql',
      '035_tgd_wms_reason_codes_foundation.sql',
      '036_tgd_wms_billing_movement_weight_view.sql',
    ];

    for (const fileName of files) {
      const sql = fs.readFileSync(path.resolve('database/migrations', fileName), 'utf8');
      expect(sql).not.toMatch(/drop\s+table/i);
      expect(sql).not.toMatch(/truncate/i);
      expect(sql).not.toMatch(/delete\s+from/i);
    }

    const unifiedSql = fs.readFileSync(path.resolve('database/migrations/034_tgd_wms_unified_movement_read_view.sql'), 'utf8');
    expect(unifiedSql).toContain('billing_exclusion_reason');
    expect(unifiedSql).toContain('is_billable');
    expect(unifiedSql).toContain('billing_status');

    const reasonSql = fs.readFileSync(path.resolve('database/migrations/035_tgd_wms_reason_codes_foundation.sql'), 'utf8');
    expect(reasonSql).toContain('UAT_ADJUST');
    expect(reasonSql).toContain('on conflict (reason_code) do nothing');

    const weightSql = fs.readFileSync(path.resolve('database/migrations/036_tgd_wms_billing_movement_weight_view.sql'), 'utf8');
    expect(weightSql).toContain(BILLING_MOVEMENT_WEIGHT_VIEW_NAME);
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BILLING_SERVICE_TYPES,
  isBillingSourceMovement,
  isDraftMovement,
  normalizeMovementType,
} from '../../src/constants/movementTypeMapping.js';
import {
  UNIFIED_MOVEMENT_VIEW_NAME,
  mergeUnifiedMovementRows,
  normalizeInventoryMovementRow,
  normalizeStockMovementRow,
} from '../../src/services/unifiedMovementReadService.js';
import { resolveQuantity } from '../../src/utils/stockFieldAliases.js';

describe('Gate 1 unified movement read model', () => {
  it('maps RECEIVE_CONFIRM to canonical RECEIVE', () => {
    expect(normalizeMovementType('RECEIVE_CONFIRM')).toBe('RECEIVE');
    expect(normalizeMovementType('RECEIVE')).toBe('RECEIVE');
  });

  it('normalizes stock movement rows with quantity and source traceability', () => {
    const row = normalizeStockMovementRow({
      id: 'mv-1',
      movement_type: 'RECEIVE_CONFIRM',
      customer_id: 'cust-1',
      product_id: 'prod-1',
      quantity: 10,
      weight: 100,
      source_module: 'RECEIVING',
      source_document_id: 'doc-1',
      source_line_id: 'line-1',
      movement_date: '2026-06-08T00:00:00.000Z',
    });

    expect(row.movement_type_canonical).toBe('RECEIVE');
    expect(row.qty).toBe(10);
    expect(row.quantity).toBe(10);
    expect(row.weight).toBe(100);
    expect(row.source_document_id).toBe('doc-1');
    expect(row.is_draft).toBe(false);
    expect(row.is_billable).toBe(true);
    expect(row.billing_service_type).toBe(BILLING_SERVICE_TYPES.INBOUND_HANDLING);
  });

  it('excludes draft movements from billing source', () => {
    const draftRow = normalizeInventoryMovementRow({
      id: 'inv-1',
      movement_type: 'RECEIVE',
      movement_subtype: 'DRAFT',
      customer_id: 'cust-1',
      reference_type: 'RECEIVING_DRAFT',
      reference_id: 'doc-draft',
      qty: 5,
    });

    expect(isDraftMovement(draftRow)).toBe(true);
    expect(isBillingSourceMovement(draftRow)).toBe(false);
  });

  it('excludes pick allocate and transfer from billing source by default', () => {
    const allocate = normalizeInventoryMovementRow({
      id: 'inv-2',
      movement_type: 'PICK_ALLOCATE',
      customer_id: 'cust-1',
      reference_type: 'WITHDRAWAL_ALLOCATION',
      reference_id: 'alloc-1',
      reference_no: 'ALC-001',
      qty: 2,
    });
    const transfer = normalizeStockMovementRow({
      id: 'stock-2',
      movement_type: 'TRANSFER_CONFIRM',
      customer_id: 'cust-1',
      source_document_id: 'tr-1',
      quantity: 1,
    });

    expect(allocate.is_billable).toBe(false);
    expect(transfer.is_billable).toBe(false);
  });

  it('merges stock and inventory ledgers without dropping rows', () => {
    const merged = mergeUnifiedMovementRows(
      [{
        id: 'stock-1',
        movement_type: 'RECEIVE_CONFIRM',
        customer_id: 'cust-1',
        product_id: 'prod-1',
        quantity: 1,
        source_module: 'RECEIVING',
        source_document_id: 'doc-1',
      }],
      [{
        id: 'inv-1',
        movement_type: 'TRANSFER',
        customer_id: 'cust-1',
        product_id: 'prod-1',
        qty: 2,
        reference_type: 'TRANSFER',
        reference_id: 'tr-1',
        reference_no: 'TR-001',
      }],
    );

    expect(merged).toHaveLength(2);
    expect(merged.some((row) => row.ledger_source === 'stock_ledger')).toBe(true);
    expect(merged.some((row) => row.ledger_source === 'inventory_ledger')).toBe(true);
  });

  it('resolves quantity aliases for dashboard compatibility', () => {
    expect(resolveQuantity({ qty_on_hand: 7 })).toBe(7);
    expect(resolveQuantity({ quantity: 8 })).toBe(8);
    expect(resolveQuantity({ qty: 9 })).toBe(9);
  });

  it('includes unified movement view migration draft', () => {
    const migrationPath = path.resolve('database/migrations/034_tgd_wms_unified_movement_read_view.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(`create or replace view public.${UNIFIED_MOVEMENT_VIEW_NAME}`);
    expect(sql).toContain('tgd_stock_movements');
    expect(sql).toContain('tgd_inventory_movements');
    expect(sql).not.toMatch(/drop\s+table/i);
  });

  it('includes reason codes migration draft for UAT unblock', () => {
    const migrationPath = path.resolve('database/migrations/035_tgd_wms_reason_codes_foundation.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('tgd_reason_codes');
    expect(sql).not.toMatch(/drop\s+table/i);
  });
});

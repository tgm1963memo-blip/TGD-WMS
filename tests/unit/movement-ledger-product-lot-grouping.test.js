import { describe, expect, it } from 'vitest';
import { movementBalanceKey, sortRowsByProductThenLot } from '../../src/utils/movementLedgerExcelUtils.js';
import { annotateGroupedRows, productIdentityOf } from '../../src/components/reports/MovementLedgerTable.jsx';
import { mapMovementLedgerToInventoryReportData } from '../../src/services/operationalReportMapper.js';

// Regression coverage for a real reported bug: the same LOT number is not
// always unique per product in this business's data (a lot number has been
// observed reused across unrelated products), so grouping/sorting by LOT
// alone silently mixed different products' rows together and made the
// "sort by product" view look unsorted.
const ROW_A_LOT150 = { customer_id: 'c1', product_code: '10140-37', product_name: 'A', lot_no: '150', movement_date: '2026-01-01' };
const ROW_B_LOT150 = { customer_id: 'c1', product_code: 'SPC067', product_name: 'B', lot_no: '150', movement_date: '2026-01-02' };
const ROW_C_LOT150 = { customer_id: 'c1', product_code: 'RPC049', product_name: 'C', lot_no: '150', movement_date: '2026-01-03' };
const ROW_A_LOT153 = { customer_id: 'c1', product_code: '10140-37', product_name: 'A', lot_no: '153', movement_date: '2026-01-04' };

describe('movementLedgerExcelUtils: movementBalanceKey', () => {
  it('gives different products the same LOT number distinct keys', () => {
    expect(movementBalanceKey(ROW_A_LOT150)).not.toBe(movementBalanceKey(ROW_B_LOT150));
    expect(movementBalanceKey(ROW_B_LOT150)).not.toBe(movementBalanceKey(ROW_C_LOT150));
  });

  it('gives the same product+lot the same key regardless of other rows sharing that lot number', () => {
    const sameProductDifferentRowInstance = { ...ROW_A_LOT150, movement_date: '2026-02-01' };
    expect(movementBalanceKey(ROW_A_LOT150)).toBe(movementBalanceKey(sameProductDifferentRowInstance));
  });

  it('gives the same product two different lots distinct keys', () => {
    expect(movementBalanceKey(ROW_A_LOT150)).not.toBe(movementBalanceKey(ROW_A_LOT153));
  });
});

describe('movementLedgerExcelUtils: sortRowsByProductThenLot', () => {
  it('sorts by product first even when unrelated products share the same LOT number', () => {
    const ordered = sortRowsByProductThenLot([ROW_C_LOT150, ROW_A_LOT150, ROW_B_LOT150, ROW_A_LOT153]);
    // Grouped by product (A's two lots stay together, sorted alphabetically
    // against B/C by product code), not scattered by shared lot number.
    const productSequence = ordered.map((r) => r.product_code);
    const firstAIndex = productSequence.indexOf('10140-37');
    const lastAIndex = productSequence.lastIndexOf('10140-37');
    // Both of product A's rows are adjacent (no other product's row between them).
    expect(lastAIndex - firstAIndex).toBe(1);
  });
});

describe('MovementLedgerTable: annotateGroupedRows', () => {
  it('shows the product cell once for a product spanning multiple lots, and marks the last row of each lot', () => {
    const ordered = sortRowsByProductThenLot([ROW_B_LOT150, ROW_A_LOT153, ROW_C_LOT150, ROW_A_LOT150]);
    const annotated = annotateGroupedRows(ordered);

    const productARows = annotated.filter((r) => productIdentityOf(r) === productIdentityOf(ROW_A_LOT150));
    expect(productARows).toHaveLength(2);
    // Only the first of product A's two lot-rows shows the product cell.
    expect(productARows.filter((r) => r._showProductCell)).toHaveLength(1);
    expect(productARows[0]._showProductCell).toBe(true);
    expect(productARows[1]._showProductCell).toBe(false);

    // Every row here is the sole row of its own lot, so each is the last of its lot group.
    expect(annotated.every((r) => r._isLastOfLotGroup)).toBe(true);
  });

  it('does not collapse the product cell for two different products even if adjacent', () => {
    const annotated = annotateGroupedRows([ROW_B_LOT150, ROW_C_LOT150]);
    expect(annotated[0]._showProductCell).toBe(true);
    expect(annotated[1]._showProductCell).toBe(true);
  });

  it('marks only the last row of a multi-row lot group as the divider row', () => {
    const rowsInSameLot = [
      { ...ROW_A_LOT150, id: '1' },
      { ...ROW_A_LOT150, id: '2' },
      { ...ROW_A_LOT150, id: '3' },
    ];
    const annotated = annotateGroupedRows(rowsInSameLot);
    expect(annotated[0]._isLastOfLotGroup).toBe(false);
    expect(annotated[1]._isLastOfLotGroup).toBe(false);
    expect(annotated[2]._isLastOfLotGroup).toBe(true);
  });
});

describe('operationalReportMapper: mapMovementLedgerToInventoryReportData product/lot grouping', () => {
  it('collapses a product spanning multiple lots to one product-name row per lot block, only in productLot sort mode', () => {
    const rows = [ROW_B_LOT150, ROW_A_LOT153, ROW_C_LOT150, ROW_A_LOT150];

    const grouped = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productLot' });
    const productALines = grouped.lines.filter((l) => l.descCode === '10140-37');
    expect(productALines).toHaveLength(2);
    expect(productALines.filter((l) => l._showProductCell)).toHaveLength(1);
    expect(grouped.lines.every((l) => l._isLastOfLotGroup)).toBe(true);

    const flat = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'date' });
    expect(flat.lines.every((l) => l._showProductCell)).toBe(true);
    expect(flat.lines.every((l) => l._isLastOfLotGroup === false)).toBe(true);
  });
});

// Regression coverage for the motivating case of the trackingCode grouping
// mode: one LOT spanning two different tracking codes (two receiving
// batches under the same lot label) must be kept as two SEPARATE balance
// groups when grouping by tracking code, even though grouping by lot
// alone would pool them into one.
const ROW_TRK1 = { customer_id: 'c1', product_code: 'P1', product_name: 'Product 1', lot_no: '150', tracking_code: 'FR260101001', movement_date: '2026-01-01' };
const ROW_TRK2 = { customer_id: 'c1', product_code: 'P1', product_name: 'Product 1', lot_no: '150', tracking_code: 'FR260102001', movement_date: '2026-01-02' };

describe('movementLedgerExcelUtils: movementBalanceKey with groupBy trackingCode', () => {
  it('gives two tracking codes sharing the same lot distinct keys', () => {
    expect(movementBalanceKey(ROW_TRK1, 'trackingCode')).not.toBe(movementBalanceKey(ROW_TRK2, 'trackingCode'));
  });

  it('gives the same tracking code the same key regardless of other rows', () => {
    const sameTrackingDifferentRow = { ...ROW_TRK1, movement_date: '2026-03-01' };
    expect(movementBalanceKey(ROW_TRK1, 'trackingCode')).toBe(movementBalanceKey(sameTrackingDifferentRow, 'trackingCode'));
  });

  it('defaults to lot-based grouping when groupBy is omitted, pooling both tracking codes under the same lot key', () => {
    expect(movementBalanceKey(ROW_TRK1)).toBe(movementBalanceKey(ROW_TRK2));
  });
});

describe('sortRowsByProductThenLot with groupBy trackingCode', () => {
  it('sorts by product then tracking code, keeping each tracking code as its own block', () => {
    const ordered = sortRowsByProductThenLot([ROW_TRK2, ROW_TRK1], 'trackingCode');
    expect(ordered.map((r) => r.tracking_code)).toEqual(['FR260101001', 'FR260102001']);
  });
});

describe('operationalReportMapper: productTrackingCode sort mode', () => {
  it('treats two tracking codes under one lot as separate balance groups, unlike productLot mode', () => {
    const rows = [ROW_TRK1, ROW_TRK2];

    const byTrackingCode = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productTrackingCode' });
    const distinctKeys = new Set(byTrackingCode.lines.map((l) => l._balanceKey));
    expect(distinctKeys.size).toBe(2);
    // Different tracking codes under the same product -> each is the last
    // (and only) row of its own group, so a divider shows after both.
    expect(byTrackingCode.lines.every((l) => l._isLastOfLotGroup)).toBe(true);

    const byLot = mapMovementLedgerToInventoryReportData({ rows, sortMode: 'productLot' });
    const distinctLotKeys = new Set(byLot.lines.map((l) => l._balanceKey));
    expect(distinctLotKeys.size).toBe(1);
  });
});

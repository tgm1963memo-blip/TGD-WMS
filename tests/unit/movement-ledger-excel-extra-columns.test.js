import { describe, expect, it } from 'vitest';
import { buildMovementLedgerExcelRows } from '../../src/utils/movementLedgerExcelUtils.js';
import { rowsToSheet } from '../../src/utils/excelFileUtils.js';

// Regression coverage for a real request: the Movement Ledger Excel export
// needs customer name, temperature, location, and product category per
// row (previously only carried on-screen, never in the exported columns),
// and the sheet should size its own columns instead of defaulting to
// Excel's narrow auto-width.
const ROW = {
  id: 'row-1',
  movement_type: 'RECEIVE_CONFIRM',
  movement_date: '2026-08-01T07:00:00Z',
  customer_id: 'cust-1',
  customer_name: 'บริษัท ทดสอบ จำกัด',
  product_code: 'P-1',
  customer_product_code: 'P-1',
  product_name: 'สินค้าทดสอบ',
  product_category: 'เนื้อ',
  lot_no: 'L1',
  tracking_code: 'FR260801001',
  temperature_type: 'FROZEN',
  location_name: 'Z1 · A-01',
  qty: 10,
  weight: 100,
};

describe('Movement Ledger Excel export — customer/temperature/location/category columns', () => {
  it('includes all four new columns with the row\'s resolved values', () => {
    const [row] = buildMovementLedgerExcelRows([ROW], new Map(), 'date');
    expect(row['ลูกค้า']).toBe('บริษัท ทดสอบ จำกัด');
    expect(row['ประเภทสินค้า']).toBe('เนื้อ');
    expect(row['อุณหภูมิ']).toBe('FROZEN');
    expect(row['Location']).toBe('Z1 · A-01');
  });

  it('falls back to "-" when a row has none of the four values', () => {
    const bareRow = { ...ROW, customer_name: null, product_category: null, temperature_type: null, location_name: null };
    const [row] = buildMovementLedgerExcelRows([bareRow], new Map(), 'date');
    expect(row['ลูกค้า']).toBe('-');
    expect(row['ประเภทสินค้า']).toBe('-');
    expect(row['อุณหภูมิ']).toBe('-');
    expect(row['Location']).toBe('-');
  });

  it('leaves the new columns blank (not "-") on the grand-total row', () => {
    const rows = buildMovementLedgerExcelRows([ROW], new Map(), 'date');
    const totalsRow = rows[rows.length - 1];
    expect(totalsRow['ประเภท']).toBe('รวมทั้งหมด');
    expect(totalsRow['ลูกค้า']).toBe('');
    expect(totalsRow['ประเภทสินค้า']).toBe('');
    expect(totalsRow['อุณหภูมิ']).toBe('');
    expect(totalsRow['Location']).toBe('');
  });

  it('carries the same four columns on a ยกมา (opening balance) row when grouped', () => {
    const opening = new Map([[`cust-1|P-1 - สินค้าทดสอบ|lot:L1`, { qty: 5, weight: 50 }]]);
    const rows = buildMovementLedgerExcelRows([ROW], opening, 'productLot');
    const openingRow = rows.find((r) => r['ประเภท'] === 'ยกมา');
    expect(openingRow).toBeTruthy();
    expect(openingRow['ลูกค้า']).toBe('บริษัท ทดสอบ จำกัด');
    expect(openingRow['ประเภทสินค้า']).toBe('เนื้อ');
    expect(openingRow['อุณหภูมิ']).toBe('FROZEN');
    expect(openingRow['Location']).toBe('Z1 · A-01');
  });
});

describe('rowsToSheet column widths', () => {
  it('applies !cols wch entries in header order when columnWidths is given', () => {
    const sheet = rowsToSheet([{ a: '1', b: '2' }], ['a', 'b'], [10, 20]);
    expect(sheet['!cols']).toEqual([{ wch: 10 }, { wch: 20 }]);
  });

  it('omits !cols entirely when no columnWidths are given (unchanged default behavior)', () => {
    const sheet = rowsToSheet([{ a: '1' }], ['a']);
    expect(sheet['!cols']).toBeUndefined();
  });
});

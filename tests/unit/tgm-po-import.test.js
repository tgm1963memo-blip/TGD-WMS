import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dayOfYear,
  formatTgmLot,
  isTgmCustomerCode,
  mapTgmPoRowsToDepositLines,
  parseBplusAmount,
  parseTgmPoFile,
} from '../../src/utils/tgmPoImportUtils.js';

const CATALOG = [
  { id: 'p20', customer_product_code: 'RCC020', product_name: 'มันไก่', pack_weight_kg: 10, temperature_type: 'FROZEN' },
  { id: 'p16', customer_product_code: 'RCC016', product_name: 'ไส้ BB', pack_weight_kg: null, temperature_type: 'CHILLED' },
];

function poRow(overrides = {}) {
  return {
    __row: 2,
    DI_REF: 'OR6256910/0106',
    AP_CODE: 'BB-T',
    SKU_CODE: 'RCC020',
    TRD_QTY: '$390.00 ',
    TRD_UTQNAME: 'KG',
    TRH_SHIP_DATE: '02/11/2026',
    ...overrides,
  };
}

describe('tgmPoImportUtils helpers', () => {
  it('recognises TGM by customer code only', () => {
    expect(isTgmCustomerCode('C002')).toBe(true);
    expect(isTgmCustomerCode(' c002 ')).toBe(true);
    expect(isTgmCustomerCode('C001')).toBe(false);
    expect(isTgmCustomerCode('')).toBe(false);
  });

  it('parses B-Plus currency text amounts', () => {
    expect(parseBplusAmount('$390.00 ')).toBe(390);
    expect(parseBplusAmount('$1,390.50')).toBe(1390.5);
    expect(parseBplusAmount(42)).toBe(42);
    expect(parseBplusAmount('')).toBeNull();
    expect(parseBplusAmount('abc')).toBeNull();
  });

  it('computes the day of year', () => {
    expect(dayOfYear('2026-11-02')).toBe(306);
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-12-31')).toBe(365);
    expect(dayOfYear('2028-12-31')).toBe(366);
    expect(dayOfYear('')).toBeNull();
  });

  it('formats the TGM lot', () => {
    expect(formatTgmLot(306, '39')).toBe('Lot 306 Sup 39');
    expect(formatTgmLot(5, '39')).toBe('Lot 005 Sup 39');
    expect(formatTgmLot(306, '')).toBe('Lot 306');
  });
});

describe('mapTgmPoRowsToDepositLines', () => {
  it('fills code, weight, boxes and lot from a PO row', () => {
    const { lines, preview } = mapTgmPoRowsToDepositLines([poRow()], CATALOG, 7, { 'BB-T': '39' });
    expect(preview[0].status).toBe('ok');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      key: 7,
      catalog_product_id: 'p20',
      customer_product_code: 'RCC020',
      expected_weight: '390',
      weight_per_box: '10',
      expected_boxes: '39',
      pack_entry_mode: 'WEIGHT',
      temperature_type: 'FROZEN',
      lot_no: 'Lot 306 Sup 39',
      line_note: 'PO OR6256910/0106',
    });
  });

  it('still imports without a sup mapping or catalog unit weight, with warnings', () => {
    const { lines, preview } = mapTgmPoRowsToDepositLines(
      [poRow({ SKU_CODE: 'RCC016', TRD_QTY: '$420.00 ' })],
      CATALOG,
      1,
      {},
    );
    expect(preview[0].status).toBe('warn');
    expect(preview[0].messages.join(' ')).toMatch(/sup/);
    expect(preview[0].messages.join(' ')).toMatch(/กก\.\/กล่อง/);
    expect(lines[0]).toMatchObject({ lot_no: 'Lot 306', expected_weight: '420', weight_per_box: '', expected_boxes: '' });
  });

  it('skips rows not in the catalog or with a bad date', () => {
    const { lines, preview } = mapTgmPoRowsToDepositLines(
      [poRow({ SKU_CODE: 'XXX1' }), poRow({ __row: 3, TRH_SHIP_DATE: '31/02/2026' })],
      CATALOG,
      1,
      { 'BB-T': '39' },
    );
    expect(lines).toHaveLength(0);
    expect(preview.map((p) => p.status)).toEqual(['skip', 'skip']);
  });

  it('accepts an ISO ship date from a real date cell', () => {
    const { lines } = mapTgmPoRowsToDepositLines([poRow({ TRH_SHIP_DATE: '2026-01-05' })], CATALOG, 1, { 'BB-T': '39' });
    expect(lines[0].lot_no).toBe('Lot 005 Sup 39');
  });
});

describe('parseTgmPoFile', () => {
  it('reads the B-Plus PO template', async () => {
    const buffer = readFileSync(resolve(process.cwd(), 'Template/PO.xls'));
    const { rows, errors } = await parseTgmPoFile({ arrayBuffer: async () => buffer });
    expect(errors).toEqual([]);
    const { lines } = mapTgmPoRowsToDepositLines(rows, CATALOG, 1, { 'BB-T': '39' });
    expect(lines.map((l) => [l.customer_product_code, l.expected_weight, l.lot_no])).toEqual([
      ['RCC020', '390', 'Lot 306 Sup 39'],
      ['RCC016', '420', 'Lot 306 Sup 39'],
    ]);
  });

  it('rejects a file without the PO columns', async () => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['รหัสสินค้าลูกค้า'], ['A']]), 'S');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const { errors } = await parseTgmPoFile({ arrayBuffer: async () => buffer });
    expect(errors[0]).toMatch(/SKU_CODE/);
  });
});

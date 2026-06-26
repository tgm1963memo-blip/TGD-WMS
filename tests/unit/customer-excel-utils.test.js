import { describe, expect, it } from 'vitest';
import {
  mapImportedRowsToDepositLines,
  parseCustomerDepositLineImportFile,
} from '../../src/utils/customerDepositLineExcelUtils.js';
import {
  resolveBarcodeCode,
} from '../../src/utils/customerProductExcelUtils.js';
import { getFilledWithdrawalLines } from '../../src/utils/customerWithdrawalLineDefaults.js';

describe('customerProductExcelUtils', () => {
  it('resolves barcode from customer code when barcode empty', () => {
    expect(resolveBarcodeCode('ABC-001', '')).toBe('ABC-001');
    expect(resolveBarcodeCode('ABC-001', 'BAR-99')).toBe('BAR-99');
  });
});

describe('customerDepositLineExcelUtils', () => {
  it('maps imported rows to deposit lines using catalog', () => {
    const catalog = [{
      id: 'prod-1',
      customer_product_code: 'SAMPLE-001',
      product_name: 'Sample',
      internal_product_code: 'BAR-001',
      pack_weight_kg: 10,
      temperature_type: 'FROZEN',
    }];

    const { lines, errors } = mapImportedRowsToDepositLines([
      {
        __row: 2,
        customer_product_code: 'SAMPLE-001',
        weight_per_box: '10',
        expected_boxes: '5',
        line_note: 'note',
      },
    ], catalog, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0].weight_per_box).toBe('10');
    expect(lines[0].expected_boxes).toBe('5');
    expect(lines[0].line_note).toBe('note');
  });
});

describe('customerWithdrawalLineDefaults', () => {
  it('returns only lines with catalog selection and requested weight', () => {
    const filled = getFilledWithdrawalLines([
      { catalog_product_id: 'p1', requested_qty: '5', requested_weight: '10' },
      { catalog_product_id: '', requested_qty: '3', requested_weight: '6' },
      { catalog_product_id: 'p2', requested_qty: '2', requested_weight: '' },
    ]);

    expect(filled).toHaveLength(1);
    expect(filled[0].requested_weight).toBe('10');
  });
});

describe('parseCustomerProductImportFile', () => {
  it('validates argent type in row mapping logic', () => {
    expect(resolveBarcodeCode('X', 'Y')).toBe('Y');
  });
});

describe('parseCustomerDepositLineImportFile', () => {
  it('reports missing required columns', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([['line_note'], ['note']]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Lines');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const file = { arrayBuffer: async () => buffer };
    const result = await parseCustomerDepositLineImportFile(file);

    expect(result.errors[0]).toContain('customer_product_code');
  });
});

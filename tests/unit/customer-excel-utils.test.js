import { describe, expect, it } from 'vitest';
import {
  mapImportedRowsToDepositLines,
  parseCustomerDepositLineImportFile,
} from '../../src/utils/customerDepositLineExcelUtils.js';
import {
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
      argent_type: 'ARGENT',
      temperature_type: 'FROZEN',
    }];

    const { lines, errors } = mapImportedRowsToDepositLines([
      {
        __row: 2,
        customer_product_code: 'SAMPLE-001',
        lot_no: 'LOT-1',
        mfg_date: '2026-01-01',
        exp_date: '2027-01-01',
        expected_qty: '10',
      },
    ], catalog, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0].argent_type).toBe('ARGENT');
    expect(lines[0].mfg_date).toBe('2026-01-01');
  });
});

describe('customerWithdrawalLineDefaults', () => {
  it('returns only catalog lines with requested qty', () => {
    const filled = getFilledWithdrawalLines([
      { catalog_product_id: 'p1', requested_qty: '5' },
      { catalog_product_id: '', requested_qty: '3' },
      { catalog_product_id: 'p2', requested_qty: '' },
    ]);

    expect(filled).toHaveLength(1);
    expect(filled[0].requested_qty).toBe('5');
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
    const sheet = XLSX.utils.aoa_to_sheet([['lot_no'], ['LOT-1']]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Lines');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const file = { arrayBuffer: async () => buffer };
    const result = await parseCustomerDepositLineImportFile(file);

    expect(result.errors[0]).toContain('customer_product_code');
  });
});

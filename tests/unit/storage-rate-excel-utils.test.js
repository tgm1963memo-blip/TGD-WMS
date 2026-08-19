import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildStorageRateLookupMap,
  mapRateRowToExcelRow,
  parseStorageRateImportFile,
} from '../../src/utils/storageRateExcelUtils.js';

async function excelFileFromRows(rows, headers) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return {
    arrayBuffer: async () => buffer,
  };
}

describe('mapRateRowToExcelRow', () => {
  it('maps a joined rate row to the export shape', () => {
    expect(mapRateRowToExcelRow({
      customer_code: 'CUST-001',
      customer_product_code: 'SKU-1',
      product_name: 'Frozen Shrimp',
      service_type: 'STORAGE',
      rate: 2.5,
      unit_basis: 'PER_KG',
      currency: 'THB',
      note: 'test',
      is_active: false,
    })).toEqual({
      customer_code: 'CUST-001',
      customer_product_code: 'SKU-1',
      product_name: 'Frozen Shrimp',
      service_type: 'STORAGE',
      rate: 2.5,
      unit_basis: 'PER_KG',
      currency: 'THB',
      note: 'test',
      is_active: 'FALSE',
      min_charge_amount: '',
      contract_start_date: '',
      contract_end_date: '',
      free_days: '',
      discount_percent: '',
      contract_note: '',
    });
  });
});

describe('buildStorageRateLookupMap', () => {
  it('keys by upper-cased customer_code::customer_product_code', () => {
    const map = buildStorageRateLookupMap([
      { id: 'cp-1', customer_product_code: 'sku-1', tgd_customers: { customer_code: 'cust-001' } },
    ]);
    expect(map.get('CUST-001::SKU-1')).toEqual({
      id: 'cp-1', customer_product_code: 'sku-1', tgd_customers: { customer_code: 'cust-001' },
    });
  });

  it('skips rows missing a code', () => {
    const map = buildStorageRateLookupMap([{ id: 'cp-1', customer_product_code: 'SKU-1' }]);
    expect(map.size).toBe(0);
  });
});

describe('parseStorageRateImportFile', () => {
  const headers = ['customer_code', 'customer_product_code', 'service_type', 'rate', 'unit_basis', 'currency', 'note', 'is_active'];

  it('resolves rows against the lookup map and normalizes fields', async () => {
    const file = await excelFileFromRows([
      { customer_code: 'CUST-001', customer_product_code: 'SKU-1', service_type: 'storage', rate: '2.5', unit_basis: 'per_kg', currency: 'THB', note: 'x', is_active: 'TRUE' },
    ], headers);
    const lookupMap = new Map([['CUST-001::SKU-1', { id: 'cp-1' }]]);

    const { rows, errors } = await parseStorageRateImportFile(file, lookupMap);

    expect(errors).toEqual([]);
    expect(rows).toEqual([{
      customerProductId: 'cp-1',
      serviceType: 'STORAGE',
      rate: 2.5,
      unitBasis: 'PER_KG',
      currency: 'THB',
      note: 'x',
      isActive: true,
      minChargeAmount: null,
      contractStartDate: null,
      contractEndDate: null,
      freeDays: null,
      discountPercent: null,
      contractNote: null,
    }]);
  });

  it('parses the new optional contract-term columns when present', async () => {
    const fullHeaders = [...headers, 'min_charge_amount', 'contract_start_date', 'contract_end_date', 'free_days', 'discount_percent', 'contract_note'];
    const file = await excelFileFromRows([
      {
        customer_code: 'CUST-001', customer_product_code: 'SKU-1', service_type: 'STORAGE', rate: '2.5', unit_basis: 'PER_KG',
        min_charge_amount: '500', contract_start_date: '2026-01-01', contract_end_date: '2026-12-31',
        free_days: '7', discount_percent: '10', contract_note: 'ลูกค้าใหม่',
      },
    ], fullHeaders);
    const lookupMap = new Map([['CUST-001::SKU-1', { id: 'cp-1' }]]);

    const { rows, errors } = await parseStorageRateImportFile(file, lookupMap);

    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      minChargeAmount: 500,
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
      freeDays: 7,
      discountPercent: 10,
      contractNote: 'ลูกค้าใหม่',
    });
  });

  it('reports an error when the customer/product pair is not found', async () => {
    const file = await excelFileFromRows([
      { customer_code: 'CUST-999', customer_product_code: 'SKU-9', service_type: 'STORAGE', rate: '1', unit_basis: 'PER_KG' },
    ], headers);

    const { rows, errors } = await parseStorageRateImportFile(file, new Map());

    expect(rows).toEqual([]);
    expect(errors[0]).toMatch(/no product found/);
  });

  it('rejects an invalid service_type', async () => {
    const file = await excelFileFromRows([
      { customer_code: 'CUST-001', customer_product_code: 'SKU-1', service_type: 'BOGUS', rate: '1', unit_basis: 'PER_KG' },
    ], headers);
    const lookupMap = new Map([['CUST-001::SKU-1', { id: 'cp-1' }]]);

    const { rows, errors } = await parseStorageRateImportFile(file, lookupMap);

    expect(rows).toEqual([]);
    expect(errors[0]).toMatch(/service_type must be one of/);
  });

  it('rejects a negative or non-numeric rate', async () => {
    const file = await excelFileFromRows([
      { customer_code: 'CUST-001', customer_product_code: 'SKU-1', service_type: 'STORAGE', rate: '-5', unit_basis: 'PER_KG' },
    ], headers);
    const lookupMap = new Map([['CUST-001::SKU-1', { id: 'cp-1' }]]);

    const { errors } = await parseStorageRateImportFile(file, lookupMap);

    expect(errors[0]).toMatch(/rate must be a number/);
  });
});

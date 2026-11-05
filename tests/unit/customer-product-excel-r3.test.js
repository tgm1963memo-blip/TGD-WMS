import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_PRODUCT_EXCEL_HEADERS,
  mapProductToExcelRow,
  parseCustomerProductImportFile,
} from '../../src/utils/customerProductExcelUtils.js';
import { resolveR3CarcassTypeCode } from '../../src/utils/r3PermitComparisonUtils.js';

const R3_TYPES = [
  { code: 'PORK_MEAT_FROZEN', animal_type: 'สุกร', label_th: 'เนื้อสุกรแช่แข็ง', sort_order: 10 },
  { code: 'PORK_FAT_FROZEN', animal_type: 'สุกร', label_th: 'มันสุกรแช่แข็ง', sort_order: 20 },
];

async function buildFile(rows) {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return { arrayBuffer: async () => buffer };
}

describe('resolveR3CarcassTypeCode', () => {
  it('accepts code, Thai label, or "animal / label", ignoring spacing', () => {
    expect(resolveR3CarcassTypeCode('PORK_FAT_FROZEN', R3_TYPES)).toBe('PORK_FAT_FROZEN');
    expect(resolveR3CarcassTypeCode('มันสุกรแช่แข็ง', R3_TYPES)).toBe('PORK_FAT_FROZEN');
    expect(resolveR3CarcassTypeCode('สุกร / เนื้อสุกรแช่แข็ง', R3_TYPES)).toBe('PORK_MEAT_FROZEN');
    expect(resolveR3CarcassTypeCode('', R3_TYPES)).toBeNull();
    expect(resolveR3CarcassTypeCode('ปลา', R3_TYPES)).toBeNull();
  });
});

describe('customer product Excel — ร.3 column', () => {
  it('exports the Thai label', () => {
    expect(CUSTOMER_PRODUCT_EXCEL_HEADERS).toContain('r3_carcass_type');
    const row = mapProductToExcelRow({ customer_product_code: 'SPC112', r3_carcass_type_code: 'PORK_FAT_FROZEN' }, R3_TYPES);
    expect(row.r3_carcass_type).toBe('มันสุกรแช่แข็ง');
  });

  it('imports a label to its code, and a blank cell to null', async () => {
    const file = await buildFile([
      ['customer_product_code', 'product_name', 'r3_carcass_type'],
      ['SPC112', 'เศษตัดแต่งจากสามชั้น', 'มันสุกรแช่แข็ง'],
      ['SPC067', 'เศษมันมัด', ''],
    ]);
    const { rows, errors } = await parseCustomerProductImportFile(file, R3_TYPES);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.r3CarcassTypeCode)).toEqual(['PORK_FAT_FROZEN', null]);
  });

  it('rejects an unknown ร.3 type rather than silently dropping it', async () => {
    const file = await buildFile([
      ['customer_product_code', 'product_name', 'r3_carcass_type'],
      ['X1', 'Fish', 'ปลาแช่แข็ง'],
    ]);
    const { rows, errors } = await parseCustomerProductImportFile(file, R3_TYPES);
    expect(rows).toEqual([]);
    expect(errors[0]).toContain('ปลาแช่แข็ง');
  });
});

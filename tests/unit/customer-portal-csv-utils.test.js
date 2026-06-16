import { describe, expect, it } from 'vitest';
import {
  parseCustomerProductImportRows,
  resolveBarcodeCode,
} from '../../src/utils/customerProductCsvUtils.js';
import {
  mapImportedRowsToDepositLines,
  parseCustomerDepositLineImportRows,
} from '../../src/utils/customerDepositLineCsvUtils.js';

describe('customerProductCsvUtils', () => {
  it('uses customer product code when barcode is blank', () => {
    expect(resolveBarcodeCode('10083', '')).toBe('10083');
    expect(resolveBarcodeCode('10083', 'BC-001')).toBe('BC-001');
  });

  it('parses product import rows', () => {
    const csv = [
      'customer_product_code,product_name,barcode_code,uom,temperature_type,note',
      '10083,Ham 1000g,,KG,CHILLED,',
    ].join('\n');

    const result = parseCustomerProductImportRows(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].internalProductCode).toBe('10083');
  });
});

describe('customerDepositLineCsvUtils', () => {
  const catalog = [{
    id: 'prod-1',
    customer_product_code: '10083',
    internal_product_code: '',
    product_name: 'Ham 1000g',
    temperature_type: 'CHILLED',
  }];

  it('maps imported deposit lines using catalog product codes', () => {
    const csv = [
      'customer_product_code,lot_no,expected_qty,expected_boxes,expected_weight,temperature_type',
      '10083,147,20,2,50,CHILLED',
    ].join('\n');

    const parsed = parseCustomerDepositLineImportRows(csv);
    const mapped = mapImportedRowsToDepositLines(parsed.rows, catalog, 1);

    expect(mapped.errors).toEqual([]);
    expect(mapped.lines).toHaveLength(1);
    expect(mapped.lines[0].catalog_product_id).toBe('prod-1');
    expect(mapped.lines[0].product_code).toBe('10083');
  });

  it('rejects unknown catalog product codes on import', () => {
    const mapped = mapImportedRowsToDepositLines(
      [{ __row: 2, customer_product_code: 'UNKNOWN', expected_qty: '5' }],
      catalog,
      1,
    );

    expect(mapped.lines).toHaveLength(0);
    expect(mapped.errors[0]).toContain('UNKNOWN');
  });
});

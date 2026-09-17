import { describe, expect, it } from 'vitest';
import {
  mapImportedRowsToLocationAssignments,
  mapProductToAssignmentRow,
  PRODUCT_LOCATION_EXCEL_HEADERS,
} from '../../src/utils/productLocationAssignmentExcelUtils.js';

describe('mapImportedRowsToLocationAssignments', () => {
  it('accepts a fully-populated row', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 2, customer_code: 'CUST-001', customer_product_code: '10154-10', location_code: '42-L-05' },
    ]);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { customer_code: 'CUST-001', customer_product_code: '10154-10', location_code: '42-L-05' },
    ]);
  });

  it('treats a blank location_code as valid (clears the assignment), not an error', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 2, customer_code: 'CUST-001', customer_product_code: '10154-10', location_code: '' },
    ]);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { customer_code: 'CUST-001', customer_product_code: '10154-10', location_code: '' },
    ]);
  });

  it('reports a missing customer_code with its row number, and drops that row', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 5, customer_code: '', customer_product_code: '10154-10', location_code: '42-L-05' },
    ]);

    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 5, reason: 'customer_code ไม่ระบุ' }]);
  });

  it('reports a missing customer_product_code with its row number, and drops that row', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 7, customer_code: 'CUST-001', customer_product_code: '', location_code: '' },
    ]);

    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 7, reason: 'customer_product_code ไม่ระบุ' }]);
  });

  it('keeps good rows and bad rows independent -- one bad row never drops the rest of the file', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 2, customer_code: 'CUST-001', customer_product_code: '10154-10', location_code: '42-L-05' },
      { __row: 3, customer_code: '', customer_product_code: '20231-22', location_code: '42-L-06' },
      { __row: 4, customer_code: 'CUST-002', customer_product_code: '30001-1', location_code: '' },
    ]);

    expect(rows).toEqual([
      { customer_code: 'CUST-001', customer_product_code: '10154-10', location_code: '42-L-05' },
      { customer_code: 'CUST-002', customer_product_code: '30001-1', location_code: '' },
    ]);
    expect(errors).toEqual([{ row: 3, reason: 'customer_code ไม่ระบุ' }]);
  });
});

describe('mapProductToAssignmentRow', () => {
  it('joins the product with its customer via the provided map', () => {
    const customersById = new Map([
      ['cust-1', { customer_code: 'CUST-001', customer_name: 'บริษัท ทดสอบ จำกัด' }],
    ]);
    const row = mapProductToAssignmentRow(
      { customer_id: 'cust-1', customer_product_code: '10154-10', product_name: 'หมูสามชั้นแช่แข็ง', locationCode: '42-L-05' },
      customersById,
    );

    expect(row).toEqual({
      customer_code: 'CUST-001',
      customer_name: 'บริษัท ทดสอบ จำกัด',
      customer_product_code: '10154-10',
      product_name: 'หมูสามชั้นแช่แข็ง',
      location_code: '42-L-05',
    });
  });

  it('produces exactly the declared header set as keys, with a blank location_code when unassigned', () => {
    const row = mapProductToAssignmentRow({ customer_id: 'missing', customer_product_code: 'X', product_name: 'Y', locationCode: null }, new Map());
    expect(Object.keys(row)).toEqual(PRODUCT_LOCATION_EXCEL_HEADERS);
    expect(row.location_code).toBe('');
  });
});

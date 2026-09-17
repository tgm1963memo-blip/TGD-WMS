import { describe, expect, it } from 'vitest';
import {
  mapImportedRowsToLocationAssignments,
  mapDepositLineToAssignmentRow,
  PRODUCT_LOCATION_EXCEL_HEADERS,
} from '../../src/utils/productLocationAssignmentExcelUtils.js';

describe('mapImportedRowsToLocationAssignments', () => {
  it('accepts a fully-populated row', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 2, customer_code: 'CUST-001', tracking_code: '10154-10', location_code: '42-L-05' },
    ]);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { __row: 2, customer_code: 'CUST-001', tracking_code: '10154-10', location_code: '42-L-05' },
    ]);
  });

  it('treats a blank location_code as valid (leaves the assignment unchanged), not an error', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 2, customer_code: 'CUST-001', tracking_code: '10154-10', location_code: '' },
    ]);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { __row: 2, customer_code: 'CUST-001', tracking_code: '10154-10', location_code: '' },
    ]);
  });

  it('reports a missing customer_code with its row number, and drops that row', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 5, customer_code: '', tracking_code: '10154-10', location_code: '42-L-05' },
    ]);

    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 5, reason: 'customer_code ไม่ระบุ' }]);
  });

  it('reports a missing tracking_code with its row number, and drops that row', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 7, customer_code: 'CUST-001', tracking_code: '', location_code: '' },
    ]);

    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 7, reason: 'tracking_code ไม่ระบุ' }]);
  });

  it('keeps good rows and bad rows independent -- one bad row never drops the rest of the file', () => {
    const { rows, errors } = mapImportedRowsToLocationAssignments([
      { __row: 2, customer_code: 'CUST-001', tracking_code: '10154-10', location_code: '42-L-05' },
      { __row: 3, customer_code: '', tracking_code: '20231-22', location_code: '42-L-06' },
      { __row: 4, customer_code: 'CUST-002', tracking_code: '30001-1', location_code: '' },
    ]);

    expect(rows).toEqual([
      { __row: 2, customer_code: 'CUST-001', tracking_code: '10154-10', location_code: '42-L-05' },
      { __row: 4, customer_code: 'CUST-002', tracking_code: '30001-1', location_code: '' },
    ]);
    expect(errors).toEqual([{ row: 3, reason: 'customer_code ไม่ระบุ' }]);
  });
});

describe('mapDepositLineToAssignmentRow', () => {
  it('joins the product with its customer via the provided map', () => {
    const customersById = new Map([
      ['cust-1', { customer_code: 'CUST-001', customer_name: 'บริษัท ทดสอบ จำกัด' }],
    ]);
    const row = mapDepositLineToAssignmentRow(
      { customerId: 'cust-1', trackingCode: 'FR260101001', customerProductCode: '10154-10', productName: 'หมูสามชั้นแช่แข็ง', locationCodes: ['42-L-05'] },
      customersById,
    );

    expect(row).toEqual({
      customer_code: 'CUST-001',
      customer_name: 'บริษัท ทดสอบ จำกัด',
      tracking_code: 'FR260101001',
      customer_product_code: '10154-10',
      product_name: 'หมูสามชั้นแช่แข็ง',
      location_code: '42-L-05',
      note: '',
    });
  });

  it('shows split locations without accidentally consolidating them', () => {
    const row = mapDepositLineToAssignmentRow({ locationCodes: ['A', 'B', 'A'] });
    expect(row.location_code).toBe('');
    expect(row.note).toBe('แบ่งเก็บ 2 location: A, B');
  });

  it('produces exactly the declared header set as keys, with a blank location_code when unassigned', () => {
    const row = mapDepositLineToAssignmentRow({ customerId: 'missing', customerProductCode: 'X', productName: 'Y', locationCodes: [] }, new Map());
    expect(Object.keys(row)).toEqual(PRODUCT_LOCATION_EXCEL_HEADERS);
    expect(row.location_code).toBe('');
  });
});

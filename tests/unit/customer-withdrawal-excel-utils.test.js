import { describe, expect, it } from 'vitest';
import {
  buildCustomerWithdrawalDocumentRows,
  downloadCustomerWithdrawalLineTemplate,
  mapImportedRowsToWithdrawalLines,
  parseCustomerWithdrawalLineImportFile,
} from '../../src/utils/customerWithdrawalLineExcelUtils.js';

const CATALOG = [{
  id: 'prod-1',
  customer_product_code: 'SAMPLE-001',
  product_name: 'Sample product',
  internal_product_code: 'BAR-001',
  temperature_type: 'FROZEN',
  argent_type: 'NON_ARGENT',
}];

const DEPOSIT_LINES = [{
  id: 'dl-1',
  deposit_request_id: 'dr-1',
  customer_product_code: 'SAMPLE-001',
  product_name: 'Sample product',
  lot_no: 'LOT-1',
  tracking_code: 'TRK-1',
  mfg_date: '2026-01-01',
  exp_date: '2026-06-01',
  actual_boxes: 10,
  actual_weight: 100,
}];

describe('customerWithdrawalLineExcelUtils: mapImportedRowsToWithdrawalLines', () => {
  it('maps a valid row matched by LOT to a withdrawal line, resolving the source deposit line', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      {
        __row: 2,
        customer_product_code: 'SAMPLE-001',
        identifier_type: 'LOT',
        identifier_value: 'LOT-1',
        requested_boxes: '4',
        note: 'test note',
      },
    ], CATALOG, DEPOSIT_LINES, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0].catalog_product_id).toBe('prod-1');
    expect(lines[0].lot_no).toBe('LOT-1');
    expect(lines[0].source_deposit_request_id).toBe('dr-1');
    expect(lines[0].source_deposit_request_line_id).toBe('dl-1');
    expect(lines[0].requested_boxes).toBe('4');
    expect(lines[0].note).toBe('test note');
  });

  it('accepts a lowercase identifier_type and is case-insensitive on product code', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      {
        __row: 2,
        customer_product_code: 'sample-001',
        identifier_type: 'tracking_code',
        identifier_value: 'TRK-1',
        requested_weight: '25',
      },
    ], CATALOG, DEPOSIT_LINES, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0].identifier_type).toBe('TRACKING_CODE');
    expect(lines[0].source_deposit_request_line_id).toBe('dl-1');
  });

  it('rejects a row whose product code is not in the catalog', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'UNKNOWN', identifier_type: 'LOT', identifier_value: 'LOT-1', requested_boxes: '1' },
    ], CATALOG, DEPOSIT_LINES, 1);

    expect(lines).toHaveLength(0);
    expect(errors[0]).toContain('not in catalog');
  });

  it('rejects a row with an invalid identifier_type', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', identifier_type: 'BOGUS', identifier_value: 'x', requested_boxes: '1' },
    ], CATALOG, DEPOSIT_LINES, 1);

    expect(lines).toHaveLength(0);
    expect(errors[0]).toContain('identifier_type');
  });

  it('rejects a row missing both requested_boxes and requested_weight', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', identifier_type: 'LOT', identifier_value: 'LOT-1' },
    ], CATALOG, DEPOSIT_LINES, 1);

    expect(lines).toHaveLength(0);
    expect(errors[0]).toContain('requested_boxes or requested_weight');
  });

  it('rejects a row whose identifier does not resolve to any live stock', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', identifier_type: 'LOT', identifier_value: 'LOT-NONEXISTENT', requested_boxes: '1' },
    ], CATALOG, DEPOSIT_LINES, 1);

    expect(lines).toHaveLength(0);
    expect(errors[0]).toContain('not found or already fully withdrawn');
  });

  it('imports valid rows even when other rows in the same batch are skipped', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', identifier_type: 'LOT', identifier_value: 'LOT-1', requested_boxes: '2' },
      { __row: 3, customer_product_code: 'UNKNOWN', identifier_type: 'LOT', identifier_value: 'LOT-1', requested_boxes: '2' },
    ], CATALOG, DEPOSIT_LINES, 1);

    expect(lines).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

const FEFO_DEPOSIT_LINES = [
  {
    id: 'dl-old',
    deposit_request_id: 'dr-old',
    customer_product_code: 'SAMPLE-001',
    product_name: 'Sample product',
    lot_no: 'LOT-OLD',
    tracking_code: 'TRK-OLD',
    actual_boxes: 5,
    actual_weight: 50,
    weight_per_box: 10,
    exp_date: '2026-06-01',
  },
  {
    id: 'dl-mid',
    deposit_request_id: 'dr-mid',
    customer_product_code: 'SAMPLE-001',
    product_name: 'Sample product',
    lot_no: 'LOT-MID',
    tracking_code: 'TRK-MID',
    actual_boxes: 5,
    actual_weight: 50,
    weight_per_box: 10,
    exp_date: '2026-07-01',
  },
  {
    id: 'dl-new',
    deposit_request_id: 'dr-new',
    customer_product_code: 'SAMPLE-001',
    product_name: 'Sample product',
    lot_no: 'LOT-NEW',
    tracking_code: 'TRK-NEW',
    actual_boxes: 5,
    actual_weight: 50,
    weight_per_box: 10,
    exp_date: '2026-08-01',
  },
];

describe('customerWithdrawalLineExcelUtils: mapImportedRowsToWithdrawalLines FEFO auto-lot selection', () => {
  it('auto-picks the soonest-to-expire lot when identifier_type/identifier_value are left blank and one lot is enough', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', identifier_type: '', identifier_value: '', requested_boxes: '3' },
    ], CATALOG, FEFO_DEPOSIT_LINES, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0].source_deposit_request_line_id).toBe('dl-old');
    expect(lines[0].identifier_type).toBe('TRACKING_CODE');
    expect(lines[0].identifier_value).toBe('TRK-OLD');
    expect(lines[0].requested_boxes).toBe('3');
  });

  it('spans multiple lots in FEFO order when the soonest-to-expire lot alone is not enough', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', requested_boxes: '8' },
    ], CATALOG, FEFO_DEPOSIT_LINES, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(2);
    expect(lines[0].source_deposit_request_line_id).toBe('dl-old');
    expect(lines[0].requested_boxes).toBe('5');
    expect(lines[1].source_deposit_request_line_id).toBe('dl-mid');
    expect(lines[1].requested_boxes).toBe('3');
  });

  it('imports all available stock across lots and reports a shortfall warning instead of rejecting the row', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', requested_boxes: '20' },
    ], CATALOG, FEFO_DEPOSIT_LINES, 1);

    expect(lines).toHaveLength(3);
    expect(lines.reduce((sum, l) => sum + Number(l.requested_boxes), 0)).toBe(15);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('shortfall 5');
  });

  it('rejects a blank-identifier row when the product has zero available stock anywhere', () => {
    const { lines, errors } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', requested_boxes: '5' },
    ], CATALOG, [], 1);

    expect(lines).toHaveLength(0);
    expect(errors[0]).toContain('no available stock found');
  });

  it('derives requested_weight from weight_per_box for a boxes-driven FEFO allocation', () => {
    const { lines } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', requested_boxes: '3' },
    ], CATALOG, FEFO_DEPOSIT_LINES, 1);

    expect(lines[0].requested_weight).toBe('30');
  });

  it('sorts a lot with no recorded exp_date to the very end, behind every dated lot', () => {
    const linesWithUnknownExpiry = [
      { ...FEFO_DEPOSIT_LINES[1] }, // exp 2026-07-01
      { ...FEFO_DEPOSIT_LINES[0], exp_date: null, id: 'dl-unknown', lot_no: 'LOT-UNKNOWN', tracking_code: 'TRK-UNKNOWN' },
    ];
    const { lines } = mapImportedRowsToWithdrawalLines([
      { __row: 2, customer_product_code: 'SAMPLE-001', requested_boxes: '8' },
    ], CATALOG, linesWithUnknownExpiry, 1);

    expect(lines).toHaveLength(2);
    expect(lines[0].source_deposit_request_line_id).toBe('dl-mid');
    expect(lines[1].source_deposit_request_line_id).toBe('dl-unknown');
  });
});

describe('customerWithdrawalLineExcelUtils: downloadCustomerWithdrawalLineTemplate', () => {
  it('does not throw when generating a template from deposit lines with remaining balance', () => {
    expect(() => downloadCustomerWithdrawalLineTemplate(DEPOSIT_LINES, 'test-template.xlsx')).not.toThrow();
  });

  it('does not throw when there are no deposit lines (sample-row fallback)', () => {
    expect(() => downloadCustomerWithdrawalLineTemplate([], 'test-template.xlsx')).not.toThrow();
  });
});

describe('customerWithdrawalLineExcelUtils: parseCustomerWithdrawalLineImportFile', () => {
  it('reports missing required columns', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([['note'], ['a note']]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Lines');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const file = { arrayBuffer: async () => buffer };
    const result = await parseCustomerWithdrawalLineImportFile(file);

    expect(result.errors[0]).toContain('customer_product_code');
  });

  it('parses rows with required columns present', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['customer_product_code', 'identifier_type', 'identifier_value', 'requested_boxes'],
      ['SAMPLE-001', 'LOT', 'LOT-1', '4'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Lines');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const file = { arrayBuffer: async () => buffer };
    const result = await parseCustomerWithdrawalLineImportFile(file);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].customer_product_code).toBe('SAMPLE-001');
  });
});

describe('customerWithdrawalLineExcelUtils: buildCustomerWithdrawalDocumentRows', () => {
  const header = {
    withdrawal_no: 'WDR-0001',
    customer_name: 'Acme Foods',
    customer_address: '123 Main St',
    contact_phone: '02-000-0000',
    requested_dispatch_date: '2026-07-21',
    destination: 'Warehouse B',
    vehicle_registration: 'AB-1234',
    note: 'handle with care',
  };

  const lines = [
    {
      id: 'wl-1',
      tracking_code: 'TRK-1',
      lot_no: 'LOT-1',
      customer_product_code: 'SAMPLE-001',
      product_name: 'Sample product',
      mfg_date: '2026-01-01',
      exp_date: '2026-06-01',
      requested_boxes: 10,
      requested_weight: 100,
    },
    {
      id: 'wl-2',
      tracking_code: 'TRK-2',
      lot_no: 'LOT-2',
      customer_product_code: 'SAMPLE-002',
      product_name: 'Another product',
      requested_boxes: 4,
      requested_weight: 40,
      picked_boxes: 3,
      picked_weight: 30,
    },
  ];

  it('includes the document header fields as key/value rows', () => {
    const { rows, docNo } = buildCustomerWithdrawalDocumentRows(header, lines);

    expect(docNo).toBe('WDR-0001');
    expect(rows).toContainEqual(['เลขที่เอกสาร', 'WDR-0001']);
    expect(rows).toContainEqual(['ลูกค้า', 'Acme Foods']);
    expect(rows).toContainEqual(['ทะเบียนรถ', 'AB-1234']);
  });

  it('uses picked quantity over requested quantity once a pick is recorded', () => {
    const { rows } = buildCustomerWithdrawalDocumentRows(header, lines);
    const lineHeaderIdx = rows.findIndex((r) => r[0] === '#');
    const line2Row = rows[lineHeaderIdx + 2];

    // columns: #, TRACKING NO, LOT NO, ITEM CODE, CUSTOMER PRODUCT, LOCATION, MFG DATE, EXP DATE, T.WEIGHT KG, BOX, ...
    expect(line2Row[8]).toBe(30);
    expect(line2Row[9]).toBe(3);
  });

  it('falls back to requested quantity when nothing has been picked yet', () => {
    const { rows } = buildCustomerWithdrawalDocumentRows(header, lines);
    const lineHeaderIdx = rows.findIndex((r) => r[0] === '#');
    const line1Row = rows[lineHeaderIdx + 1];

    expect(line1Row[8]).toBe(100);
    expect(line1Row[9]).toBe(10);
  });

  it('appends a TOTAL row summing weight and boxes across all lines', () => {
    const { rows } = buildCustomerWithdrawalDocumentRows(header, lines);
    const totalRow = rows[rows.length - 1];

    expect(totalRow).toContain('TOTAL');
    expect(totalRow).toContain(130); // 100 + 30
    expect(totalRow).toContain(13); // 10 + 3
  });

  it('does not throw when there are no lines', () => {
    expect(() => buildCustomerWithdrawalDocumentRows(header, [])).not.toThrow();
  });
});

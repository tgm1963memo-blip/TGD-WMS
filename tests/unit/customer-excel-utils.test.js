import { describe, expect, it } from 'vitest';
import {
  buildCustomerDepositDocumentRows,
  buildCustomerDepositDocumentFormRows,
  buildDepositLineSheet,
  buildDepositLineTemplateRows,
  CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS,
  mapImportedRowsToDepositLines,
  parseCustomerDepositLineImportFile,
  resolveDepositTemperatureType,
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

  // The downloadable template's example mfg_date/exp_date used to be blank
  // text, leaving a user to guess what date format the importer expects.
  // Now they're real Date values -- rowsToSheet/json_to_sheet writes those
  // as genuine Excel date cells (same convention as a user's own real
  // Excel dates), which readExcelFile's exact-serial fix already handles,
  // so filling the template in normally (overtyping an already-date cell)
  // produces exactly the format that round-trips correctly.
  it('template sample row writes mfg_date/exp_date as real Excel date cells, not text', () => {
    const rows = buildDepositLineTemplateRows([]);
    const sheet = buildDepositLineSheet(rows);

    // mfg_date/exp_date are columns H/I (8th/9th header), so on the first
    // data row (sheet row 2) that's cells H2/I2.
    expect(sheet.H2.t).toBe('n');
    expect(typeof sheet.H2.v).toBe('number');
    expect(sheet.I2.t).toBe('n');
    expect(typeof sheet.I2.v).toBe('number');
  });

  it('template headers use the same Thai labels as the on-screen deposit lines table', () => {
    expect(CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS[0]).toBe('รหัสสินค้าลูกค้า *');
    expect(CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS).toContain('การจัดเก็บ *');
    expect(CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS).toContain('จำนวนกล่อง');
    expect(CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS).toContain('น้ำหนักฝากทั้งหมด (กก.)');
  });

  it('pre-fills catalog storage as the dropdown label', () => {
    const rows = buildDepositLineTemplateRows([
      { customer_product_code: 'C-1', product_name: 'Chicken', pack_weight_kg: 12, temperature_type: 'CHILLED' },
    ]);
    expect(rows[0].temperature_type).toBe('Chilled — แช่เย็น');
    expect(rows[0].weight_per_box).toBe(12);
  });

  it('skips untouched pre-listed rows and derives the missing quantity', () => {
    const catalog = [
      { id: 'p1', customer_product_code: 'C-1', product_name: 'A', pack_weight_kg: 10, temperature_type: 'FROZEN' },
      { id: 'p2', customer_product_code: 'C-2', product_name: 'B', pack_weight_kg: 5, temperature_type: 'FROZEN' },
      { id: 'p3', customer_product_code: 'C-3', product_name: 'C', pack_weight_kg: 2, temperature_type: 'FROZEN' },
    ];
    const { lines, errors } = mapImportedRowsToDepositLines([
      { __row: 2, customer_product_code: 'C-1', weight_per_box: '10', temperature_type: 'Frozen — แช่แข็ง', expected_boxes: '3' },
      { __row: 3, customer_product_code: 'C-2', weight_per_box: '5', temperature_type: 'แช่เย็น', expected_weight: '50', mfg_date: '01/09/2569' },
      { __row: 4, customer_product_code: 'C-3', weight_per_box: '2', temperature_type: 'Frozen — แช่แข็ง' },
    ], catalog, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ expected_boxes: '3', expected_weight: '30', pack_entry_mode: 'BOXES', weight_from_master: true });
    expect(lines[1]).toMatchObject({ expected_boxes: '10', pack_entry_mode: 'WEIGHT', temperature_type: 'CHILLED', mfg_date: '2026-09-01' });
  });

  it('reports an unknown storage value and an invalid date in Thai', () => {
    const catalog = [{ id: 'p1', customer_product_code: 'C-1', pack_weight_kg: 10 }];
    const { errors } = mapImportedRowsToDepositLines([
      { __row: 2, customer_product_code: 'C-1', temperature_type: 'ร้อน', expected_boxes: '1' },
      { __row: 3, customer_product_code: 'C-1', expected_boxes: '1', exp_date: '31/02/2026' },
    ], catalog, 1);
    expect(errors[0]).toContain('การจัดเก็บ');
    expect(errors[1]).toContain('วันที่');
  });

  it('resolves Freeze&Frozen before the single Freeze/Frozen options', () => {
    expect(resolveDepositTemperatureType('Freeze&Frozen — ฟรีสและฝากแช่')).toBe('FREEZE_FROZEN');
    expect(resolveDepositTemperatureType('freeze')).toBe('FREEZE');
    expect(resolveDepositTemperatureType('', 'CHILLED')).toBe('CHILLED');
  });

  it('builds document rows with a header block, line table, and totals row', () => {
    const header = {
      request_no: 'CDR-0001',
      customer_name: 'Acme Foods',
      expected_arrival_date: '2026-08-01',
      vehicle_registration: 'AB-1234',
      note: 'handle with care',
    };
    const lines = [
      { line_no: 1, tracking_code: 'FR260801001', lot_no: 'LOT-1', customer_product_code: 'SAMPLE-001', product_name: 'Sample', actual_boxes: 10, actual_weight: 100 },
      { line_no: 2, tracking_code: 'FR260801002', lot_no: 'LOT-1', customer_product_code: 'SAMPLE-002', product_name: 'Sample 2', expected_boxes: 5, expected_weight: 25 },
    ];

    const { rows, docNo } = buildCustomerDepositDocumentRows(header, lines);

    expect(docNo).toBe('CDR-0001');
    expect(rows[0]).toEqual(['เลขที่เอกสาร', 'CDR-0001']);
    const lineHeaderIndex = rows.findIndex((r) => r[0] === '#');
    expect(rows[lineHeaderIndex + 1]).toEqual([1, 'FR260801001', 'LOT-1', 'SAMPLE-001', 'Sample', '-', '-', '-', 100, 10, '-']);
    // Second line has no actual_* recorded yet — falls back to expected_*.
    expect(rows[lineHeaderIndex + 2]).toEqual([2, 'FR260801002', 'LOT-1', 'SAMPLE-002', 'Sample 2', '-', '-', '-', 25, 5, '-']);
    const totalsRow = rows[rows.length - 1];
    expect(totalsRow[7]).toBe('TOTAL');
    expect(totalsRow[8]).toBe(125);
    expect(totalsRow[9]).toBe(15);
  });

  it('builds a form-styled sheet with a merged-cell header block carrying the same field values', () => {
    const header = {
      request_no: 'CDR-0001',
      customer_name: 'Acme Foods',
      expected_arrival_date: '2026-08-01',
      vehicle_registration: 'AB-1234',
      note: 'handle with care',
    };
    const lines = [
      { line_no: 1, tracking_code: 'FR260801001', lot_no: 'LOT-1', customer_product_code: 'SAMPLE-001', product_name: 'Sample', actual_boxes: 10, actual_weight: 100 },
    ];

    const { rows, merges, docNo } = buildCustomerDepositDocumentFormRows(header, lines);

    expect(docNo).toBe('CDR-0001');
    expect(merges.length).toBeGreaterThan(0);
    const flat = rows.flat();
    expect(flat).toContain('CDR-0001');
    expect(flat).toContain('Acme Foods');
    expect(flat).toContain('handle with care');
    const lineHeaderIndex = rows.findIndex((r) => r[0] === '#');
    expect(rows[lineHeaderIndex + 1]).toEqual([1, 'FR260801001', 'LOT-1', 'SAMPLE-001', 'Sample', '-', '-', '-', 100, 10, '-']);
    for (const m of merges) {
      expect(m.e.r).toBeLessThan(rows.length);
    }
  });

  it('does not throw building the form-styled sheet when there are no lines', () => {
    expect(() => buildCustomerDepositDocumentFormRows({ request_no: 'CDR-0002' }, [])).not.toThrow();
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

    expect(result.errors[0]).toContain('รหัสสินค้าลูกค้า');
  });

  it('round-trips a filled-in downloaded template back into deposit lines', async () => {
    const XLSX = await import('xlsx');
    const catalog = [
      { id: 'p1', customer_product_code: 'C-1', product_name: 'A', pack_weight_kg: 10, temperature_type: 'FROZEN' },
      { id: 'p2', customer_product_code: 'C-2', product_name: 'B', pack_weight_kg: 5, temperature_type: 'CHILLED' },
    ];
    const rows = buildDepositLineTemplateRows(catalog);
    rows[0].expected_boxes = 2;
    rows[0].exp_date = new Date(Date.UTC(2027, 0, 9));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, buildDepositLineSheet(rows), 'รายการฝาก');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const parsed = await parseCustomerDepositLineImportFile({ arrayBuffer: async () => buffer });
    const { lines, errors } = mapImportedRowsToDepositLines(parsed.rows, catalog, 1);

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ catalog_product_id: 'p1', expected_boxes: '2', expected_weight: '20', temperature_type: 'FROZEN', exp_date: '2027-01-09' });
  });

  it('maps the Thai template headers (with "*") to internal keys', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['รหัสสินค้าลูกค้า *', 'จำนวนกล่อง', 'การจัดเก็บ *'],
      ['C-1', 4, 'Frozen — แช่แข็ง'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'รายการฝาก');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const result = await parseCustomerDepositLineImportFile({ arrayBuffer: async () => buffer });

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ customer_product_code: 'C-1', expected_boxes: '4', temperature_type: 'Frozen — แช่แข็ง' });
  });

  // Regression for a real report: a template uploaded with mfg_date/exp_date
  // typed as genuine Excel dates (not plain text) came through as a
  // locale-formatted display string like "9/1/26" -- which then rendered as
  // a blank date everywhere downstream expects ISO YYYY-MM-DD (a native
  // <input type="date"> just shows empty for a non-ISO value, with no error
  // to explain why). aoa_to_sheet gives a JS Date value the same real
  // date-formatted cell type (t:'d') a user's own Excel date cell would have.
  it('normalizes a genuine Excel date cell (not plain text) to ISO YYYY-MM-DD', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['customer_product_code', 'mfg_date', 'exp_date'],
      ['SAMPLE-001', new Date(Date.UTC(2026, 8, 1)), new Date(Date.UTC(2027, 0, 9))],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Lines');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const file = { arrayBuffer: async () => buffer };
    const result = await parseCustomerDepositLineImportFile(file);

    expect(result.errors).toEqual([]);
    expect(result.rows[0].mfg_date).toBe('2026-09-01');
    expect(result.rows[0].exp_date).toBe('2027-01-09');
  });

  // A first attempt at the fix above (convert via cellDates:true -> JS Date
  // -> toISOString()/local getters) passed the synthetic test above but
  // silently corrupted the actual reported file: Excel serial 46266 (Excel's
  // own cached display "9/1/26", i.e. 2026-09-01) round-tripped through a JS
  // Date and landed at 2026-08-31T23:59:56 -- 4 seconds short of midnight,
  // read back as August 31 by both UTC and local extraction. Setting the
  // raw numeric serial directly (bypassing aoa_to_sheet's own Date-to-serial
  // encoding, which doesn't reproduce the drift) reproduces the exact
  // real-world case and pins the fix to SSF.parse_date_code, which reads
  // date parts directly off the serial with no such rounding.
  it('does not lose a day to floating-point drift on a real serial number that round-trips imprecisely through cellDates', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([['customer_product_code', 'mfg_date'], ['SAMPLE-001', '']]);
    sheet.B2 = { t: 'n', v: 46266, z: 'm/d/yy' };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Lines');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const file = { arrayBuffer: async () => buffer };
    const result = await parseCustomerDepositLineImportFile(file);

    expect(result.rows[0].mfg_date).toBe('2026-09-01');
  });
});

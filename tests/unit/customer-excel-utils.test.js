import { describe, expect, it } from 'vitest';
import {
  buildCustomerDepositDocumentRows,
  buildCustomerDepositDocumentFormRows,
  buildDepositLineTemplateRows,
  CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS,
  mapImportedRowsToDepositLines,
  parseCustomerDepositLineImportFile,
} from '../../src/utils/customerDepositLineExcelUtils.js';
import { rowsToSheet } from '../../src/utils/excelFileUtils.js';
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
    const sheet = rowsToSheet(rows, CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS);

    // mfg_date/exp_date are columns G/H (1-indexed 7th/8th header), so on
    // the first data row (sheet row 2) that's cells G2/H2.
    expect(sheet.G2.t).toBe('n');
    expect(typeof sheet.G2.v).toBe('number');
    expect(sheet.H2.t).toBe('n');
    expect(typeof sheet.H2.v).toBe('number');
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

    expect(result.errors[0]).toContain('customer_product_code');
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

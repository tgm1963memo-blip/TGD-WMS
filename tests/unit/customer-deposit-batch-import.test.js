import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildDepositBatchSheet,
  buildDepositBatchTemplateRows,
  DEPOSIT_BATCH_EXCEL_COLUMNS,
  groupDepositBatchRows,
  parseCustomerDepositBatchFile,
  parseDepositArrivalTime,
} from '../../src/utils/customerDepositBatchExcelUtils.js';
import { toDepositLineUpsertPayload } from '../../src/utils/customerDepositPackCalcUtils.js';

const CATALOG = [
  { id: 'p1', customer_product_code: '10003-71', product_name: 'ไส้กรอกค็อกเทล', pack_weight_kg: 15, temperature_type: 'FROZEN' },
  { id: 'p2', customer_product_code: '10024-7', product_name: 'สโมคเบค่อนบิทบาง', pack_weight_kg: 5, temperature_type: 'FROZEN' },
];

const BOUNDS = { minDate: '2026-11-04', maxDate: '2027-05-03' };

function row(overrides = {}) {
  return {
    __row: 2,
    expected_arrival_date: '2026-11-05',
    arrival_time: '08:30',
    vehicle_registration: '70-1234',
    customer_product_code: '10003-71',
    expected_boxes: '40',
    ...overrides,
  };
}

function workbookFile(aoa, cellOptions = {}) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa, cellOptions), 'รายการฝาก');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return { arrayBuffer: async () => buffer };
}

describe('groupDepositBatchRows', () => {
  it('makes one slip per delivery date, sorted by date', () => {
    const { slips, skipped } = groupDepositBatchRows([
      row({ __row: 2, expected_arrival_date: '10/11/2026' }),
      row({ __row: 3 }),
      row({ __row: 4, customer_product_code: '10024-7', expected_boxes: '', expected_weight: '250' }),
      row({ __row: 5, expected_arrival_date: '07/11/2569', arrival_time: '13:00', vehicle_registration: '' }),
    ], CATALOG, BOUNDS);

    expect(skipped).toEqual([]);
    expect(slips.map((s) => [s.date, s.lines.length])).toEqual([
      ['2026-11-05', 2],
      ['2026-11-07', 1],
      ['2026-11-10', 1],
    ]);
    expect(slips[0]).toMatchObject({ arrivalTime: '08:30', vehicleRegistration: '70-1234' });
    expect(slips[0].lines[0]).toMatchObject({ customer_product_code: '10003-71', expected_boxes: '40', expected_weight: '600' });
    expect(slips[0].lines[1]).toMatchObject({ customer_product_code: '10024-7', expected_boxes: '50', expected_weight: '250' });
    expect(slips[0].lines.map((l) => l.key)).toEqual([1, 2]);
    expect(slips[1]).toMatchObject({ arrivalTime: '13:00', vehicleRegistration: '' });
  });

  it('skips rows with a missing, invalid, past or too-far date, with the reason', () => {
    const { slips, skipped } = groupDepositBatchRows([
      row({ __row: 2, expected_arrival_date: '' }),
      row({ __row: 3, expected_arrival_date: '31/02/2026' }),
      row({ __row: 4, expected_arrival_date: '2026-10-12' }),
      row({ __row: 5, expected_arrival_date: '2027-12-01' }),
      row({ __row: 6, customer_product_code: 'XXX' }),
    ], CATALOG, BOUNDS);

    expect(slips).toEqual([]);
    expect(skipped).toHaveLength(5);
    expect(skipped[0]).toMatch(/แถว 2: ยังไม่ได้กรอกวันที่จัดส่ง/);
    expect(skipped[1]).toMatch(/แถว 3: .*ไม่ถูกต้อง/);
    expect(skipped[2]).toMatch(/แถว 4: .*ย้อนหลัง/);
    expect(skipped[3]).toMatch(/แถว 5: .*180 วัน/);
    expect(skipped[4]).toMatch(/แถว 6: .*ไม่พบรหัสสินค้า/);
  });

  it('lets admin backdate when no minimum date is given', () => {
    const { slips } = groupDepositBatchRows([row({ expected_arrival_date: '2026-10-12' })], CATALOG, { maxDate: BOUNDS.maxDate });
    expect(slips.map((s) => s.date)).toEqual(['2026-10-12']);
  });

  it('ignores untouched pre-listed rows but flags a date without a quantity', () => {
    const { slips, skipped } = groupDepositBatchRows([
      { __row: 2, customer_product_code: '10003-71', expected_arrival_date: '' },
      { __row: 3, customer_product_code: '10024-7', expected_arrival_date: '2026-11-05' },
    ], CATALOG, BOUNDS);
    expect(slips).toEqual([]);
    expect(skipped).toEqual([expect.stringMatching(/แถว 3: มีวันที่จัดส่งแต่ยังไม่ได้กรอกจำนวน/)]);
  });

  it('keeps the first time and vehicle of a date and warns about a different one', () => {
    const { slips } = groupDepositBatchRows([
      row({ __row: 2, arrival_time: '', vehicle_registration: '' }),
      row({ __row: 3, arrival_time: '09:00', vehicle_registration: '71-5678' }),
      row({ __row: 4, arrival_time: '10:00', vehicle_registration: '71-9999' }),
    ], CATALOG, BOUNDS);
    expect(slips[0]).toMatchObject({ arrivalTime: '09:00', vehicleRegistration: '71-5678' });
    expect(slips[0].warnings).toEqual([
      expect.stringMatching(/แถว 4: เวลาถึง 10:00 .* 09:00/),
      expect.stringMatching(/แถว 4: ทะเบียนรถ 71-9999 .* 71-5678/),
    ]);
  });
});

describe('parseDepositArrivalTime', () => {
  it('reads Excel time fractions and typed text', () => {
    expect(parseDepositArrivalTime(0.5)).toEqual({ time: '12:00', valid: true });
    expect(parseDepositArrivalTime(8.5 / 24)).toEqual({ time: '08:30', valid: true });
    expect(parseDepositArrivalTime('8.30')).toEqual({ time: '08:30', valid: true });
    expect(parseDepositArrivalTime('13:05:00')).toEqual({ time: '13:05', valid: true });
    expect(parseDepositArrivalTime('')).toEqual({ time: '', valid: true });
    expect(parseDepositArrivalTime('25:00').valid).toBe(false);
  });
});

describe('parseCustomerDepositBatchFile', () => {
  it('reads back the downloaded template once dates and quantities are filled', async () => {
    const rows = buildDepositBatchTemplateRows(CATALOG);
    rows[0] = { ...rows[0], expected_arrival_date: new Date(Date.UTC(2026, 10, 5)), arrival_time: '08:30', expected_boxes: 40 };
    rows[1] = { ...rows[1], expected_arrival_date: new Date(Date.UTC(2026, 10, 7)), expected_weight: 250 };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, buildDepositBatchSheet(rows), 'รายการฝาก');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const parsed = await parseCustomerDepositBatchFile({ arrayBuffer: async () => buffer });
    expect(parsed.errors).toEqual([]);
    const { slips, skipped } = groupDepositBatchRows(parsed.rows, CATALOG, BOUNDS);
    expect(skipped).toEqual([]);
    expect(slips.map((s) => [s.date, s.arrivalTime, s.lines[0].customer_product_code, s.lines[0].expected_weight])).toEqual([
      ['2026-11-05', '08:30', '10003-71', '600'],
      ['2026-11-07', '', '10024-7', '250'],
    ]);
  });

  it('keeps the hours of a time-formatted เวลาถึง cell', async () => {
    const headers = DEPOSIT_BATCH_EXCEL_COLUMNS.map((c) => c.label);
    const sheetRow = headers.map(() => '');
    sheetRow[0] = '05/11/2026';
    sheetRow[3] = '10003-71';
    sheetRow[headers.indexOf('จำนวนกล่อง')] = 10;
    const file = workbookFile([headers, sheetRow]);
    // Turn the time column into a real Excel time cell (13:30).
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    workbook.Sheets[workbook.SheetNames[0]].B2 = { t: 'n', v: 13.5 / 24, z: 'hh:mm' };
    const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const parsed = await parseCustomerDepositBatchFile({ arrayBuffer: async () => out });
    const { slips } = groupDepositBatchRows(parsed.rows, CATALOG, BOUNDS);
    expect(slips[0]).toMatchObject({ date: '2026-11-05', arrivalTime: '13:30' });
  });

  it('rejects the single-request template, which has no delivery date column', async () => {
    const { errors } = await parseCustomerDepositBatchFile(workbookFile([['รหัสสินค้าลูกค้า *', 'จำนวนกล่อง'], ['10003-71', 5]]));
    expect(errors[0]).toMatch(/วันที่จัดส่ง/);
  });
});

describe('toDepositLineUpsertPayload', () => {
  it('sends a packaging-unit mode as BOXES plus the unit columns', () => {
    const base = { customer_product_code: 'A', expected_boxes: '4', expected_weight: '40', weight_per_box: '10', lot_no: '', mfg_date: '' };
    expect(toDepositLineUpsertPayload({ ...base, pack_entry_mode: 'WEIGHT' }, 3)).toMatchObject({
      lineNo: 3, packEntryMode: 'WEIGHT', entryUnitCode: null, lotNo: null, mfgDate: null,
    });
    expect(toDepositLineUpsertPayload({ ...base, pack_entry_mode: 'CASE', entry_unit_qty: '2' }, 1)).toMatchObject({
      packEntryMode: 'BOXES', entryUnitCode: 'CASE', entryUnitQty: '2',
    });
  });
});

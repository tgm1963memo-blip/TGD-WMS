import * as XLSX from 'xlsx';
import { readExcelFile } from './excelFileUtils.js';
import {
  CUSTOMER_DEPOSIT_LINE_EXCEL_COLUMNS,
  DEPOSIT_TEMPERATURE_LABELS,
  HEADER_TO_KEY,
  isBlank,
  mapDepositLineToExcelRow,
  mapImportedRowsToDepositLines,
  normalizeHeaderText,
  parseDepositExcelDate,
} from './customerDepositLineExcelUtils.js';

// One Excel file -> several deposit requests: every row carries its own
// delivery date, and rows sharing a date become one draft request. The line
// columns are the single-request template's, unchanged, so filling either
// template works the same way.

// Bounds a manually-typed arrival date to a plausible near-term window —
// catches a mistyped year (e.g. 2027 instead of 2026) before it saves.
export const MAX_ARRIVAL_DATE_DAYS_AHEAD = 180;

export function maxArrivalDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + MAX_ARRIVAL_DATE_DAYS_AHEAD);
  return d.toISOString().split('T')[0];
}

export const DEPOSIT_BATCH_HEADER_COLUMNS = [
  { key: 'expected_arrival_date', label: 'วันที่จัดส่ง * (วว/ดด/ปปปป)', width: 22, aliases: ['วันที่จัดส่ง', 'วันที่ฝากสินค้า', 'วันที่ฝาก'] },
  { key: 'arrival_time', label: 'เวลาถึง (ชช:นน)', width: 14, aliases: ['เวลาถึง', 'เวลาที่รถถึง'] },
  { key: 'vehicle_registration', label: 'ทะเบียนรถ', width: 12, aliases: [] },
];

export const DEPOSIT_BATCH_EXCEL_COLUMNS = [...DEPOSIT_BATCH_HEADER_COLUMNS, ...CUSTOMER_DEPOSIT_LINE_EXCEL_COLUMNS];

const BATCH_HEADER_TO_KEY = new Map([
  ...HEADER_TO_KEY,
  ...DEPOSIT_BATCH_HEADER_COLUMNS.flatMap((col) => [col.key, col.label, ...col.aliases]
    .map((name) => [normalizeHeaderText(name), col.key])),
]);

const LINE_INPUT_KEYS = ['expected_boxes', 'expected_weight', 'lot_no', 'mfg_date', 'exp_date', 'line_note'];

// A time typed into Excel becomes a fraction of a day (08:30 -> 0.354...),
// a time typed into a text cell stays "8:30" / "08.30". Returns HH:MM.
export function parseDepositArrivalTime(value) {
  if (isBlank(value)) return { time: '', valid: true };
  if (typeof value === 'number' && Number.isFinite(value)) {
    const minutes = Math.round((value - Math.floor(value)) * 1440) % 1440;
    const pad = (n) => String(n).padStart(2, '0');
    return { time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`, valid: true };
  }
  const match = String(value).trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return { time: '', valid: false };
  return { time: `${match[1].padStart(2, '0')}:${match[2]}`, valid: true };
}

function isoToDateCell(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : '';
}

// Same as the single-request template: every catalog product pre-listed, so
// the customer types a date and a quantity on the rows they deliver (and
// copies a row for a product that arrives on more than one day).
export function buildDepositBatchTemplateRows(catalogProducts = []) {
  if (catalogProducts.length > 0) {
    return catalogProducts.map((p) => mapDepositLineToExcelRow({
      customer_product_code: p.customer_product_code,
      product_name: p.product_name,
      weight_per_box: p.pack_weight_kg,
      temperature_type: p.temperature_type ?? 'FROZEN',
    }));
  }
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [{
    ...mapDepositLineToExcelRow({
      customer_product_code: 'SAMPLE-001',
      product_name: 'ตัวอย่างชื่อสินค้า',
      weight_per_box: 10,
      temperature_type: 'FROZEN',
      expected_boxes: 10,
      expected_weight: 100,
    }),
    expected_arrival_date: isoToDateCell(tomorrow),
    arrival_time: '08:30',
  }];
}

export function buildDepositBatchSheet(rows = []) {
  const aoa = [
    DEPOSIT_BATCH_EXCEL_COLUMNS.map((col) => col.label),
    ...rows.map((row) => DEPOSIT_BATCH_EXCEL_COLUMNS.map((col) => row[col.key] ?? '')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: false, dateNF: 'dd/mm/yyyy' });
  sheet['!cols'] = DEPOSIT_BATCH_EXCEL_COLUMNS.map((col) => ({ wch: col.width }));
  return sheet;
}

const BATCH_TEMPLATE_INSTRUCTIONS = [
  ['วิธีกรอกใบแจ้งฝากหลายวัน (Excel)'],
  [],
  ['1.', 'กรอกในชีต "รายการฝาก" เท่านั้น 1 แถว = 1 สินค้า ห้ามแก้ชื่อหัวคอลัมน์'],
  ['2.', 'ระบบสร้างใบแจ้งฝากให้ "วันละ 1 ใบ" ตามคอลัมน์วันที่จัดส่ง แถวที่วันที่เดียวกันจะอยู่ในใบเดียวกัน'],
  ['3.', `วันที่จัดส่ง กรอกเป็น วว/ดด/ปปปป เช่น 05/11/2026 หรือ 05/11/2569 (พ.ศ.) ได้ ห้ามย้อนหลัง และไม่เกิน ${MAX_ARRIVAL_DATE_DAYS_AHEAD} วันล่วงหน้า`],
  ['4.', 'เวลาถึง (ชช:นน) และทะเบียนรถไม่บังคับ ถ้าวันเดียวกันกรอกไม่ตรงกัน ระบบใช้ค่าจากแถวแรกของวันนั้นและเตือนในหน้าตรวจสอบ'],
  ['5.', 'ระบบใส่รหัสสินค้า ชื่อสินค้า น้ำหนักต่อหน่วย และการจัดเก็บไว้ให้แล้ว กรอกเพิ่มแค่วันที่จัดส่ง และ "จำนวนกล่อง" หรือ "น้ำหนักฝากทั้งหมด" อย่างใดอย่างหนึ่ง'],
  ['6.', 'สินค้าเดียวกันเข้าหลายวัน หรือหลาย LOT ให้คัดลอกแถวแล้วแก้วันที่ / เลข LOT'],
  ['7.', 'แถวที่ไม่ได้กรอกจำนวน ระบบจะข้ามให้อัตโนมัติ ไม่ต้องลบทิ้ง'],
  ['8.', 'ผู้ติดต่อ เบอร์โทร หมายเหตุ และ ร.3 กรอกครั้งเดียวในหน้าตรวจสอบหลังอัปโหลด ใช้กับทุกใบ'],
  ['9.', 'ใบที่ระบบสร้างเป็น "ร่าง" ทั้งหมด เปิดตรวจแล้วกดส่งทีละใบ'],
  [],
  ['ค่าที่ใช้ได้ในคอลัมน์ "การจัดเก็บ"'],
  ...Object.values(DEPOSIT_TEMPERATURE_LABELS).map((label) => ['', label]),
];

export function downloadCustomerDepositBatchTemplate(catalogProducts = [], filename = 'แม่แบบใบแจ้งฝากหลายวัน.xlsx') {
  const workbook = XLSX.utils.book_new();
  // The data sheet must stay first: readExcelFile imports the first sheet.
  XLSX.utils.book_append_sheet(workbook, buildDepositBatchSheet(buildDepositBatchTemplateRows(catalogProducts)), 'รายการฝาก');
  const help = XLSX.utils.aoa_to_sheet(BATCH_TEMPLATE_INSTRUCTIONS);
  help['!cols'] = [{ wch: 6 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, help, 'วิธีกรอก');
  XLSX.writeFile(workbook, filename);
}

export async function parseCustomerDepositBatchFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const keyByHeader = new Map();
  headers.forEach((header) => {
    const key = BATCH_HEADER_TO_KEY.get(normalizeHeaderText(header));
    if (key && !keyByHeader.has(header)) keyByHeader.set(header, key);
  });

  const keys = new Set(keyByHeader.values());
  const missing = [];
  if (!keys.has('expected_arrival_date')) missing.push('"วันที่จัดส่ง"');
  if (!keys.has('customer_product_code')) missing.push('"รหัสสินค้าลูกค้า"');
  if (missing.length) {
    return {
      rows: [],
      errors: [`ไม่พบคอลัมน์ ${missing.join(' และ ')} — กรุณาใช้ไฟล์จากปุ่ม "ดาวน์โหลดเทมเพลต" ของหน้านำเข้าหลายใบ`],
    };
  }

  // readExcelFile turns any date-formatted cell into a date, which drops a
  // time-formatted cell's hours — take เวลาถึง from the raw cell values.
  const timeHeader = [...keyByHeader].find(([, key]) => key === 'arrival_time')?.[0];
  let rawRows = [];
  if (timeHeader) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: true });
  }

  return {
    rows: rows.map((row, index) => {
      const mapped = { __row: row.__row ?? index + 2 };
      for (const [header, key] of keyByHeader) mapped[key] = row[header];
      if (timeHeader && typeof rawRows[index]?.[timeHeader] === 'number') mapped.arrival_time = rawRows[index][timeHeader];
      return mapped;
    }),
    errors: [],
  };
}

// Splits imported rows into one draft request per delivery date. Each
// group's lines go through mapImportedRowsToDepositLines, the single-request
// import, so catalog lookup, box/weight maths and per-row checks are the
// same. Rows that can't be used are reported in `skipped`, never silently
// dropped (except untouched pre-listed catalog rows).
export function groupDepositBatchRows(rows, catalogProducts = [], { minDate = '', maxDate = '' } = {}) {
  const byDate = new Map();
  const skipped = [];

  rows.forEach((row) => {
    const untouched = LINE_INPUT_KEYS.every((key) => isBlank(row[key]));
    const hasDate = !isBlank(row.expected_arrival_date);
    if (untouched && !hasDate) return;
    if (untouched) {
      skipped.push(`แถว ${row.__row}: มีวันที่จัดส่งแต่ยังไม่ได้กรอกจำนวนกล่องหรือน้ำหนัก`);
      return;
    }
    if (!hasDate) {
      skipped.push(`แถว ${row.__row}: ยังไม่ได้กรอกวันที่จัดส่ง`);
      return;
    }
    const parsed = parseDepositExcelDate(row.expected_arrival_date);
    if (!parsed.valid || !parsed.date) {
      skipped.push(`แถว ${row.__row}: วันที่จัดส่ง "${row.expected_arrival_date}" ไม่ถูกต้อง (ใช้ วว/ดด/ปปปป)`);
      return;
    }
    if (minDate && parsed.date < minDate) {
      skipped.push(`แถว ${row.__row}: วันที่จัดส่งย้อนหลัง`);
      return;
    }
    if (maxDate && parsed.date > maxDate) {
      skipped.push(`แถว ${row.__row}: วันที่จัดส่งเกิน ${MAX_ARRIVAL_DATE_DAYS_AHEAD} วันล่วงหน้า`);
      return;
    }
    if (!byDate.has(parsed.date)) byDate.set(parsed.date, []);
    byDate.get(parsed.date).push(row);
  });

  const slips = [];
  [...byDate.keys()].sort().forEach((date) => {
    const dateRows = byDate.get(date);
    const { lines, errors } = mapImportedRowsToDepositLines(dateRows, catalogProducts, 1);
    skipped.push(...errors);
    if (!lines.length) return;

    // Header values come from the date's first row that has one; a
    // different value on a later row of the same date is reported.
    const warnings = [];
    let arrivalTime = '';
    let vehicleRegistration = '';
    dateRows.forEach((row) => {
      const time = parseDepositArrivalTime(row.arrival_time);
      if (!time.valid) {
        warnings.push(`แถว ${row.__row}: เวลาถึง "${row.arrival_time}" ไม่ถูกต้อง (ใช้ ชช:นน) จึงไม่ได้ใช้`);
      } else if (time.time && !arrivalTime) {
        arrivalTime = time.time;
      } else if (time.time && time.time !== arrivalTime) {
        warnings.push(`แถว ${row.__row}: เวลาถึง ${time.time} ไม่ตรงกับแถวแรกของวันนี้ ระบบจะใช้ ${arrivalTime}`);
      }
      const vehicle = String(row.vehicle_registration ?? '').trim();
      if (vehicle && !vehicleRegistration) {
        vehicleRegistration = vehicle;
      } else if (vehicle && vehicle !== vehicleRegistration) {
        warnings.push(`แถว ${row.__row}: ทะเบียนรถ ${vehicle} ไม่ตรงกับแถวแรกของวันนี้ ระบบจะใช้ ${vehicleRegistration}`);
      }
    });

    slips.push({ date, arrivalTime, vehicleRegistration, lines, warnings });
  });

  const rowNo = (message) => Number(message.match(/^แถว (\d+)/)?.[1] ?? 0);
  skipped.sort((a, b) => rowNo(a) - rowNo(b));
  return { slips, skipped };
}

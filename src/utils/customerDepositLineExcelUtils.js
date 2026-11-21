import * as XLSX from 'xlsx';
import { downloadExcelWorkbook, formatExcelDate, readExcelFile } from './excelFileUtils.js';
import { calcBoxesFromTotalWeight, calcTotalWeightFromBoxes, PACK_ENTRY_MODES } from './customerDepositPackCalcUtils.js';

// Same columns, labels and order as CustomerDepositLinesTable on screen, so
// a customer filling the template sees exactly the fields they'd otherwise
// type into the form. "วิธีกรอก" (entry mode) is not a column: it's inferred
// from whichever of จำนวนกล่อง / น้ำหนักฝากทั้งหมด is filled in.
export const CUSTOMER_DEPOSIT_LINE_EXCEL_COLUMNS = [
  { key: 'customer_product_code', label: 'รหัสสินค้าลูกค้า *', width: 20, aliases: ['รหัสสินค้าลูกค้า', 'รหัสสินค้า'] },
  { key: 'product_name', label: 'ชื่อสินค้า (ไม่ต้องแก้)', width: 32, aliases: ['ชื่อสินค้า'] },
  { key: 'weight_per_box', label: 'น้ำหนักต่อหน่วย (กก.) *', width: 20, aliases: ['น้ำหนักต่อหน่วย', 'น้ำหนักต่อกล่อง'] },
  { key: 'temperature_type', label: 'การจัดเก็บ *', width: 24, aliases: ['การจัดเก็บ', 'storage'] },
  { key: 'expected_boxes', label: 'จำนวนกล่อง', width: 14, aliases: ['กล่อง'] },
  { key: 'expected_weight', label: 'น้ำหนักฝากทั้งหมด (กก.)', width: 22, aliases: ['น้ำหนักฝากทั้งหมด', 'น้ำหนักรวม'] },
  { key: 'lot_no', label: 'เลข LOT', width: 16, aliases: ['lot'] },
  { key: 'mfg_date', label: 'วันผลิต (วว/ดด/ปปปป)', width: 20, aliases: ['วันผลิต'] },
  { key: 'exp_date', label: 'วันหมดอายุ (วว/ดด/ปปปป)', width: 22, aliases: ['วันหมดอายุ'] },
  { key: 'line_note', label: 'หมายเหตุ', width: 28, aliases: ['note'] },
];

export const CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS = CUSTOMER_DEPOSIT_LINE_EXCEL_COLUMNS.map((c) => c.label);

// Labels match the การจัดเก็บ dropdown in CustomerDepositLinesTable.
export const DEPOSIT_TEMPERATURE_LABELS = {
  CHILLED: 'Chilled — แช่เย็น',
  FROZEN: 'Frozen — แช่แข็ง',
  FREEZE: 'Freeze — ฝากฟรีส',
  FREEZE_FROZEN: 'Freeze&Frozen — ฟรีสและฝากแช่',
};

const TEMPERATURE_ALIASES = {
  CHILLED: ['chilled', 'chill', 'แช่เย็น', 'เย็น'],
  FROZEN: ['frozen', 'แช่แข็ง', 'แข็ง'],
  FREEZE: ['freeze', 'ฝากฟรีส', 'ฟรีส'],
  FREEZE_FROZEN: ['freeze&frozen', 'freeze_frozen', 'freeze & frozen', 'ฟรีสและฝากแช่'],
};

function normalizeHeaderText(value) {
  return String(value ?? '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Every spelling a column may arrive under -> its internal key: the current
// Thai label (with or without "*"), its short aliases, and the old English
// key headers of earlier templates, so files people already filled in still
// import.
const HEADER_TO_KEY = new Map(
  CUSTOMER_DEPOSIT_LINE_EXCEL_COLUMNS.flatMap((col) => [col.key, col.label, ...col.aliases]
    .map((name) => [normalizeHeaderText(name), col.key])),
);

export function resolveDepositTemperatureType(value, fallback = 'FROZEN') {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  for (const [code, label] of Object.entries(DEPOSIT_TEMPERATURE_LABELS)) {
    if (text === code.toLowerCase() || text === label.toLowerCase()) return code;
  }
  // "Freeze&Frozen" contains both "freeze" and "frozen", so check the
  // combined option before the single ones.
  for (const code of ['FREEZE_FROZEN', 'CHILLED', 'FROZEN', 'FREEZE']) {
    if (TEMPERATURE_ALIASES[code].some((alias) => text === alias || text.startsWith(`${alias} `))) return code;
  }
  return null;
}

// Accepts an ISO date (what readExcelFile produces from a real Excel date
// cell) or a typed d/m/yyyy text date; a Buddhist-era year (> 2400) is
// converted to CE, since Thai users routinely type e.g. 01/09/2569.
export function parseDepositExcelDate(value) {
  const iso = formatExcelDate(value);
  if (!iso || /^\d{4}-\d{2}-\d{2}$/.test(iso)) return { date: iso, valid: true };
  const match = iso.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return { date: '', valid: false };
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year > 2400) year -= 543;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return { date: '', valid: false };
  }
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${year}-${pad(month)}-${pad(day)}`, valid: true };
}

function isoToDateCell(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : value;
}

export function mapDepositLineToExcelRow(line = {}) {
  return {
    customer_product_code: line.customer_product_code ?? '',
    product_name: line.product_name ?? '',
    weight_per_box: line.weight_per_box ?? '',
    temperature_type: DEPOSIT_TEMPERATURE_LABELS[line.temperature_type] ?? line.temperature_type ?? '',
    expected_boxes: line.expected_boxes ?? '',
    expected_weight: line.expected_weight ?? '',
    lot_no: line.lot_no ?? '',
    mfg_date: isoToDateCell(line.mfg_date),
    exp_date: isoToDateCell(line.exp_date),
    line_note: line.line_note ?? '',
  };
}

// Pure builder (no file I/O) so the row layout -- specifically that the
// example mfg_date/exp_date land as real date cells, not text -- can be
// unit tested without touching XLSX.writeFile.
//
// With a catalog, every product is pre-listed (code, name, unit weight,
// storage already filled) so the customer only types quantities on the
// products they're depositing; rows left without a quantity are skipped on
// import instead of being reported as errors.
export function buildDepositLineTemplateRows(catalogProducts = []) {
  const rows = catalogProducts.length > 0
    ? catalogProducts.map((p) => mapDepositLineToExcelRow({
        customer_product_code: p.customer_product_code,
        product_name: p.product_name,
        weight_per_box: p.pack_weight_kg,
        temperature_type: p.temperature_type ?? 'FROZEN',
      }))
    : [{
        ...mapDepositLineToExcelRow({
          customer_product_code: 'SAMPLE-001',
          product_name: 'ตัวอย่างชื่อสินค้า',
          weight_per_box: 10,
          temperature_type: 'FROZEN',
          expected_boxes: 10,
          expected_weight: 100,
          line_note: 'ตัวอย่างหมายเหตุ',
        }),
        // Real Date objects (not text) so they're written as genuine
        // Excel date cells -- the format readExcelFile handles best, and
        // overtyping a date-formatted cell in Excel keeps it one.
        mfg_date: new Date(),
        exp_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }];
  return rows;
}

export function buildDepositLineSheet(rows = []) {
  const aoa = [
    CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS,
    ...rows.map((row) => CUSTOMER_DEPOSIT_LINE_EXCEL_COLUMNS.map((col) => row[col.key] ?? '')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: false, dateNF: 'dd/mm/yyyy' });
  sheet['!cols'] = CUSTOMER_DEPOSIT_LINE_EXCEL_COLUMNS.map((col) => ({ wch: col.width }));
  return sheet;
}

const TEMPLATE_INSTRUCTIONS = [
  ['วิธีกรอกใบแจ้งฝากสินค้า (Excel)'],
  [],
  ['1.', 'กรอกในชีต "รายการฝาก" เท่านั้น ห้ามแก้ชื่อหัวคอลัมน์'],
  ['2.', 'ระบบใส่รหัสสินค้า ชื่อสินค้า น้ำหนักต่อหน่วย และการจัดเก็บไว้ให้แล้ว — กรอกเพิ่มแค่ "จำนวนกล่อง" หรือ "น้ำหนักฝากทั้งหมด" ในแถวสินค้าที่จะฝาก'],
  ['3.', 'กรอกจำนวนกล่อง หรือ น้ำหนักฝากทั้งหมด อย่างใดอย่างหนึ่งก็พอ ระบบคำนวณอีกช่องให้จากน้ำหนักต่อหน่วย'],
  ['4.', 'แถวที่ไม่ได้กรอกจำนวน ระบบจะข้ามให้อัตโนมัติ ไม่ต้องลบทิ้ง'],
  ['5.', 'สินค้าที่มีน้ำหนักต่อหน่วยในแคตตาล็อกแล้ว ระบบจะใช้ค่าจากแคตตาล็อก (เหมือนหน้าจอ)'],
  ['6.', 'วันผลิต / วันหมดอายุ กรอกเป็น วว/ดด/ปปปป เช่น 01/09/2026 หรือ 01/09/2569 (พ.ศ.) ได้'],
  ['7.', 'เพิ่มสินค้าเดียวกันหลาย LOT ได้ โดยคัดลอกแถวแล้วแก้เลข LOT / วันที่'],
  [],
  ['ค่าที่ใช้ได้ในคอลัมน์ "การจัดเก็บ"'],
  ...Object.values(DEPOSIT_TEMPERATURE_LABELS).map((label) => ['', label]),
  ['', '(เว้นว่างได้ — ระบบใช้ค่าตั้งต้นของสินค้าในแคตตาล็อก)'],
];

function buildInstructionSheet() {
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_INSTRUCTIONS);
  sheet['!cols'] = [{ wch: 6 }, { wch: 100 }];
  return sheet;
}

function downloadDepositLineWorkbook(rows, filename, withInstructions) {
  const workbook = XLSX.utils.book_new();
  // The data sheet must stay first: readExcelFile imports the first sheet.
  XLSX.utils.book_append_sheet(workbook, buildDepositLineSheet(rows), 'รายการฝาก');
  if (withInstructions) XLSX.utils.book_append_sheet(workbook, buildInstructionSheet(), 'วิธีกรอก');
  XLSX.writeFile(workbook, filename);
}

export function downloadCustomerDepositLineTemplate(catalogProducts = [], filename = 'แม่แบบใบแจ้งฝากสินค้า.xlsx') {
  downloadDepositLineWorkbook(buildDepositLineTemplateRows(catalogProducts), filename, true);
}

export function exportCustomerDepositLinesExcel(lines = [], filename = 'customer-deposit-lines.xlsx') {
  const filled = lines.filter((line) => line.customer_product_code);
  downloadDepositLineWorkbook(filled.map(mapDepositLineToExcelRow), filename, true);
}

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

export function mapImportedRowsToDepositLines(rows, catalogProducts = [], startKey = 1) {
  const catalogByCode = new Map(
    catalogProducts.map((product) => [String(product.customer_product_code ?? '').trim().toUpperCase(), product]),
  );

  const lines = [];
  const errors = [];

  rows.forEach((row) => {
    const customerProductCode = String(row.customer_product_code ?? '').trim();
    const untouched = ['expected_boxes', 'expected_weight', 'lot_no', 'mfg_date', 'exp_date', 'line_note']
      .every((key) => isBlank(row[key]));

    // Pre-listed catalog rows the customer didn't fill in, and fully blank
    // rows, are simply not part of this deposit.
    if (untouched) return;

    if (!customerProductCode) {
      errors.push(`แถว ${row.__row}: ยังไม่ได้กรอกรหัสสินค้าลูกค้า`);
      return;
    }
    const catalog = catalogByCode.get(customerProductCode.toUpperCase());
    if (!catalog) {
      errors.push(`แถว ${row.__row}: ไม่พบรหัสสินค้า "${customerProductCode}" ในแคตตาล็อก`);
      return;
    }

    // Same rule as picking the product on screen: a catalog unit weight is
    // authoritative (the field is read-only there).
    const hasMasterWeight = !isBlank(catalog.pack_weight_kg);
    const weightPerBox = hasMasterWeight
      ? String(catalog.pack_weight_kg)
      : String(row.weight_per_box ?? '').trim();
    let expectedBoxes = String(row.expected_boxes ?? '').trim();
    let expectedWeight = String(row.expected_weight ?? '').trim();

    if (!weightPerBox || !(Number(weightPerBox) > 0)) {
      errors.push(`แถว ${row.__row}: น้ำหนักต่อหน่วยต้องมากกว่า 0`);
      return;
    }
    const boxesOk = Number(expectedBoxes) > 0;
    const weightOk = Number(expectedWeight) > 0;
    if (!boxesOk && !weightOk) {
      errors.push(`แถว ${row.__row}: กรุณากรอกจำนวนกล่อง หรือ น้ำหนักฝากทั้งหมด`);
      return;
    }

    const temperatureType = resolveDepositTemperatureType(row.temperature_type, catalog.temperature_type ?? 'FROZEN');
    if (!temperatureType) {
      errors.push(`แถว ${row.__row}: การจัดเก็บ "${row.temperature_type}" ไม่ถูกต้อง (ใช้ Chilled / Frozen / Freeze / Freeze&Frozen)`);
      return;
    }

    const mfg = parseDepositExcelDate(row.mfg_date);
    const exp = parseDepositExcelDate(row.exp_date);
    if (!mfg.valid || !exp.valid) {
      errors.push(`แถว ${row.__row}: รูปแบบวันที่ไม่ถูกต้อง (ใช้ วว/ดด/ปปปป)`);
      return;
    }

    // Mirror the on-screen entry modes: boxes entered -> weight derived;
    // only weight entered -> boxes derived.
    const packEntryMode = boxesOk ? PACK_ENTRY_MODES.BOXES : PACK_ENTRY_MODES.WEIGHT;
    if (boxesOk) {
      expectedWeight = calcTotalWeightFromBoxes(expectedBoxes, weightPerBox) || expectedWeight;
    } else {
      expectedBoxes = calcBoxesFromTotalWeight(expectedWeight, weightPerBox) || expectedBoxes;
    }

    lines.push({
      key: startKey + lines.length,
      catalog_product_id: catalog.id,
      customer_product_code: catalog.customer_product_code ?? customerProductCode,
      product_code: catalog.internal_product_code ?? catalog.customer_product_code ?? customerProductCode,
      product_name: catalog.product_name ?? '',
      temperature_type: temperatureType,
      weight_per_box: weightPerBox,
      weight_from_master: hasMasterWeight,
      expected_weight: expectedWeight,
      expected_boxes: expectedBoxes,
      pack_entry_mode: packEntryMode,
      entry_unit_code: '',
      entry_unit_qty: '',
      lot_no: String(row.lot_no ?? '').trim(),
      mfg_date: mfg.date,
      exp_date: exp.date,
      line_note: String(row.line_note ?? '').trim(),
    });
  });

  return { lines, errors };
}

export async function parseCustomerDepositLineImportFile(file) {
  const { headers, rows } = await readExcelFile(file);
  // Header cells are matched loosely (case, "*", spacing) against the
  // current Thai labels and the legacy English keys.
  const keyByHeader = new Map();
  headers.forEach((header) => {
    const key = HEADER_TO_KEY.get(normalizeHeaderText(header));
    if (key && !keyByHeader.has(header)) keyByHeader.set(header, key);
  });

  if (![...keyByHeader.values()].includes('customer_product_code')) {
    return {
      rows: [],
      errors: ['ไม่พบคอลัมน์ "รหัสสินค้าลูกค้า" — กรุณาใช้ไฟล์จากปุ่ม "ดาวน์โหลด Template"'],
    };
  }

  return {
    rows: rows.map((row, index) => {
      const mapped = { __row: index + 2 };
      for (const [header, key] of keyByHeader) mapped[key] = row[header];
      return mapped;
    }),
    errors: [],
  };
}

function fmtExcelDate(v) {
  if (!v) return '-';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s;
}

// actual_* is the CONFIRMED received quantity once recorded — falls back to
// expected_* while still awaiting receiving, same rule
// CustomerDepositStaffWorkOrderPrint uses, so the exported spreadsheet
// always matches the printed document's figures.
function confirmedDepositQty(line) {
  return {
    boxes: line.actual_boxes ?? line.expected_boxes ?? null,
    weight: line.actual_weight ?? line.expected_weight ?? null,
  };
}

const DEPOSIT_DOCUMENT_LINE_HEADERS = [
  '#', 'TRACKING NO', 'LOT NO', 'ITEM CODE', 'CUSTOMER PRODUCT', 'LOCATION',
  'MFG DATE', 'EXP DATE', 'T.WEIGHT KG', 'BOX', 'REMARK',
];

// Shared by the flat document export and the form-styled one below so both
// always show the exact same line figures (same confirmedDepositQty
// fallback rule the printed document itself uses).
function buildDepositLineRowsAndTotal(lines) {
  let totalBoxes = 0;
  let totalWeight = 0;

  const lineRows = lines.map((line, idx) => {
    const qty = confirmedDepositQty(line);
    if (qty.boxes != null) totalBoxes += Number(qty.boxes) || 0;
    if (qty.weight != null) totalWeight += Number(qty.weight) || 0;
    return [
      idx + 1,
      line.tracking_code ?? '-',
      line.lot_no ?? '-',
      line.customer_product_code ?? line.internal_product_code ?? '-',
      line.product_name ?? '-',
      line.location_code ?? line.location ?? '-',
      fmtExcelDate(line.mfg_date),
      fmtExcelDate(line.exp_date),
      qty.weight ?? '-',
      qty.boxes ?? '-',
      [line.note, line.actual_note].filter(Boolean).join(' / ') || '-',
    ];
  });

  const totalRow = ['', '', '', '', '', '', '', 'TOTAL', totalWeight || '-', totalBoxes || '-', ''];
  return { lineRows, totalRow };
}

function depositHeaderFields(header) {
  return {
    customerName: header.customer_name ?? header.customer?.customer_name ?? header.customer?.name ?? '-',
    customerAddress: header.customer_address ?? header.customer?.address ?? '-',
    contactPhone: header.contact_phone ?? header.customer?.phone ?? '-',
    contactFax: header.contact_fax ?? header.customer?.fax ?? '-',
    docDate: header.expected_arrival_date
      ? header.expected_arrival_date
      : header.created_at ? header.created_at.split('T')[0] : '-',
    docNo: header.request_no ?? '-',
  };
}

// Pure builder (no file I/O) so the row layout can be unit tested, and so
// it can be reused server-side (api/process-email-queue.js attaches this
// to the customer confirmation email) without touching XLSX.writeFile,
// which writes to the filesystem under Node instead of triggering a
// browser download — mirrors buildCustomerWithdrawalDocumentRows exactly.
export function buildCustomerDepositDocumentRows(header = {}, lines = []) {
  const { customerName, customerAddress, contactPhone, contactFax, docDate, docNo } = depositHeaderFields(header);
  const { lineRows, totalRow } = buildDepositLineRowsAndTotal(lines);

  const rows = [
    ['เลขที่เอกสาร', docNo],
    ['ลูกค้า', customerName],
    ['ที่อยู่', customerAddress],
    ['โทร', contactPhone],
    ['แฟกซ์', contactFax],
    ['วันที่', fmtExcelDate(docDate)],
    ['ทะเบียนรถ', header.vehicle_registration ?? '-'],
    ['ผู้ติดต่อ', header.contact_name ?? '-'],
    ['หมายเหตุ', header.note ?? '-'],
    [],
    DEPOSIT_DOCUMENT_LINE_HEADERS,
    ...lineRows,
    totalRow,
  ];

  return { rows, docNo };
}

// Exports one deposit request (header + lines) as a single-sheet
// spreadsheet — mirrors exportCustomerWithdrawalDocumentExcel.
export function exportCustomerDepositDocumentExcel(header = {}, lines = [], filename) {
  const { rows, docNo } = buildCustomerDepositDocumentRows(header, lines);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  downloadExcelWorkbook(sheet, filename ?? `${docNo}.xlsx`, 'Deposit');
}

function mergeRange(r, c1, c2) {
  return { s: { r, c: c1 }, e: { r, c: c2 } };
}

// A "form"-styled alternative to buildCustomerDepositDocumentRows above:
// same fields and same line table, but the header block is laid out as a
// merged-cell grid (label | value spanning several columns, two fields per
// row) instead of one label/value pair per row — mirrors
// buildCustomerWithdrawalDocumentFormRows.
export function buildCustomerDepositDocumentFormRows(header = {}, lines = []) {
  const { customerName, customerAddress, contactPhone, contactFax, docDate, docNo } = depositHeaderFields(header);
  const { lineRows, totalRow } = buildDepositLineRowsAndTotal(lines);

  const rows = [];
  const merges = [];

  function titleRow(text) {
    rows.push([text, '', '', '', '', '']);
    merges.push(mergeRange(rows.length - 1, 0, 5));
  }

  function metaRow(pairs) {
    const r = rows.length;
    if (pairs.length === 1) {
      rows.push([pairs[0][0], pairs[0][1], '', '', '', '']);
      merges.push(mergeRange(r, 1, 5));
    } else {
      rows.push([pairs[0][0], pairs[0][1], '', pairs[1][0], pairs[1][1], '']);
      merges.push(mergeRange(r, 1, 2));
      merges.push(mergeRange(r, 4, 5));
    }
  }

  titleRow('ใบแจ้งฝากสินค้า / DEPOSIT REQUEST');
  rows.push([]);
  metaRow([['เลขที่เอกสาร', docNo], ['วันที่', fmtExcelDate(docDate)]]);
  metaRow([['ลูกค้า', customerName]]);
  metaRow([['ที่อยู่', customerAddress]]);
  metaRow([['โทร', contactPhone], ['แฟกซ์', contactFax]]);
  metaRow([['ทะเบียนรถ', header.vehicle_registration ?? '-'], ['ผู้ติดต่อ', header.contact_name ?? '-']]);
  if (header.note) metaRow([['หมายเหตุ', header.note]]);
  rows.push([]);
  rows.push(DEPOSIT_DOCUMENT_LINE_HEADERS);
  rows.push(...lineRows);
  rows.push(totalRow);

  return { rows, merges, docNo };
}

export function exportCustomerDepositDocumentFormExcel(header = {}, lines = [], filename) {
  const { rows, merges, docNo } = buildCustomerDepositDocumentFormRows(header, lines);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = merges;
  sheet['!cols'] = DEPOSIT_DOCUMENT_LINE_HEADERS.map(() => ({ wch: 14 }));
  downloadExcelWorkbook(sheet, filename ?? `${docNo}-form.xlsx`, 'Deposit');
}

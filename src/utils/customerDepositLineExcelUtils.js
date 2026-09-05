import * as XLSX from 'xlsx';
import { downloadExcelRows, downloadExcelWorkbook, formatExcelDate, readExcelFile } from './excelFileUtils.js';

export const CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS = [
  'customer_product_code',
  'product_name',
  'weight_per_box',
  'expected_weight',
  'expected_boxes',
  'lot_no',
  'mfg_date',
  'exp_date',
  'line_note',
];

export function mapDepositLineToExcelRow(line = {}) {
  return {
    customer_product_code: line.customer_product_code ?? '',
    product_name: line.product_name ?? '',
    weight_per_box: line.weight_per_box ?? '',
    expected_weight: line.expected_weight ?? '',
    expected_boxes: line.expected_boxes ?? '',
    lot_no: line.lot_no ?? '',
    mfg_date: line.mfg_date ?? '',
    exp_date: line.exp_date ?? '',
    line_note: line.line_note ?? '',
  };
}

// Pure builder (no file I/O) so the row layout -- specifically that the
// example mfg_date/exp_date land as real date cells, not text -- can be
// unit tested without touching XLSX.writeFile.
export function buildDepositLineTemplateRows(catalogProducts = []) {
  const rows = catalogProducts.length > 0
    ? catalogProducts.map((p) => ({
        customer_product_code: p.customer_product_code ?? '',
        product_name: p.product_name ?? '',
        weight_per_box: p.pack_weight_kg ?? '',
        expected_weight: '',
        expected_boxes: '',
        lot_no: '',
        mfg_date: '',
        exp_date: '',
        line_note: '',
      }))
    : [{
        customer_product_code: 'SAMPLE-001',
        product_name: 'Sample product name',
        weight_per_box: '10',
        expected_weight: '100',
        expected_boxes: '10',
        lot_no: '',
        // Real Date objects (not text) -- rowsToSheet/json_to_sheet writes
        // these as genuine Excel date cells, the same kind readExcelFile
        // now parses correctly via the exact-serial fix. Filling this
        // template in normally (typing/picking a date in Excel, which
        // keeps whatever cell already showed here formatted as a date)
        // produces exactly the format the importer handles best, instead
        // of the user having to guess what plain-text format is expected.
        mfg_date: new Date(),
        exp_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        line_note: 'ตัวอย่างหมายเหตุ',
      }];
  return rows;
}

export function downloadCustomerDepositLineTemplate(catalogProducts = [], filename = 'customer-deposit-lines-template.xlsx') {
  downloadExcelRows(buildDepositLineTemplateRows(catalogProducts), CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS, filename, 'DepositLines');
}

export function exportCustomerDepositLinesExcel(lines = [], filename = 'customer-deposit-lines.xlsx') {
  downloadExcelRows(
    lines.map(mapDepositLineToExcelRow),
    CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS,
    filename,
    'DepositLines',
  );
}

export function mapImportedRowsToDepositLines(rows, catalogProducts = [], startKey = 1) {
  const catalogByCode = new Map(
    catalogProducts.map((product) => [String(product.customer_product_code ?? '').trim().toUpperCase(), product]),
  );

  const lines = [];
  const errors = [];

  rows.forEach((row) => {
    const customerProductCode = String(row.customer_product_code ?? '').trim();
    const catalog = catalogByCode.get(customerProductCode.toUpperCase());

    if (!customerProductCode) {
      errors.push(`Row ${row.__row}: customer_product_code is required.`);
      return;
    }
    if (!catalog) {
      errors.push(`Row ${row.__row}: product code "${customerProductCode}" is not in catalog.`);
      return;
    }

    const weightPerBox = String(row.weight_per_box ?? catalog.pack_weight_kg ?? '').trim();
    const expectedWeight = String(row.expected_weight ?? '').trim();
    const expectedBoxes = String(row.expected_boxes ?? '').trim();

    if (!weightPerBox || Number(weightPerBox) <= 0) {
      errors.push(`Row ${row.__row}: weight_per_box must be greater than 0.`);
      return;
    }
    if ((!expectedWeight || Number(expectedWeight) <= 0) && (!expectedBoxes || Number(expectedBoxes) <= 0)) {
      errors.push(`Row ${row.__row}: expected_weight or expected_boxes is required.`);
      return;
    }

    lines.push({
      key: startKey + lines.length,
      catalog_product_id: catalog.id,
      customer_product_code: catalog.customer_product_code ?? customerProductCode,
      product_code: catalog.internal_product_code ?? catalog.customer_product_code ?? customerProductCode,
      product_name: catalog.product_name ?? '',
      temperature_type: catalog.temperature_type ?? 'FROZEN',
      weight_per_box: weightPerBox,
      expected_weight: expectedWeight,
      expected_boxes: expectedBoxes,
      pack_entry_mode: expectedWeight && !expectedBoxes ? 'WEIGHT' : 'BOXES',
      lot_no: String(row.lot_no ?? '').trim(),
      mfg_date: formatExcelDate(row.mfg_date),
      exp_date: formatExcelDate(row.exp_date),
      line_note: String(row.line_note ?? '').trim(),
    });
  });

  return { lines, errors };
}

const REQUIRED_IMPORT_HEADERS = ['customer_product_code'];

export async function parseCustomerDepositLineImportFile(file) {
  const { headers, rows } = await readExcelFile(file);
  // Compare case-insensitively and trimmed: a header cell retyped/reformatted
  // in Excel (different casing, stray whitespace) is still the same column
  // to a user, but used to fail this strict exact-match check.
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const missingHeaders = REQUIRED_IMPORT_HEADERS.filter(
    (header) => !normalizedHeaders.includes(header.trim().toLowerCase()),
  );
  if (missingHeaders.length) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
    };
  }

  return {
    rows: rows.map((row, index) => ({ ...row, __row: index + 2 })),
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

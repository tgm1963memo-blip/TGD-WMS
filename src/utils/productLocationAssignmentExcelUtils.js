import { downloadExcelWorkbookMultiSheet, readExcelFile } from './excelFileUtils.js';

export const PRODUCT_LOCATION_EXCEL_HEADERS = [
  'customer_code',
  'customer_name',
  'tracking_code',
  'customer_product_code',
  'product_name',
  'location_code',
  'note',
];

// Only customer_code, tracking_code and location_code are used on import.
const LOCATION_REFERENCE_HEADERS = ['location_code', 'section', 'capacity'];
const LOCATION_REFERENCE_SHEET_NAME = 'รหัส Location ที่มีในระบบ';
const DATA_SHEET_NAME = 'TrackingCodes';

function buildLocationReferenceRows(locations = []) {
  return locations.map((loc) => ({
    location_code: loc.code,
    section: loc.sectionName ?? loc.sectionCode ?? '',
    capacity: loc.capacity ?? '',
  }));
}

export function mapDepositLineToAssignmentRow(line = {}, customersById = new Map()) {
  const customer = customersById.get(line.customerId);
  const codes = [...new Set(line.locationCodes ?? [])];
  return {
    customer_code: customer?.customer_code ?? '',
    customer_name: customer?.customer_name ?? '',
    tracking_code: line.trackingCode ?? '',
    customer_product_code: line.customerProductCode ?? '',
    product_name: line.productName ?? '',
    location_code: codes.length === 1 ? codes[0] : '',
    note: codes.length > 1 ? `แบ่งเก็บ ${codes.length} location: ${codes.join(', ')}` : '',
  };
}

// Both export and template are two-sheet workbooks: Sheet 1 is the editable
// data, Sheet 2 lists every real location_code currently in the system so
// whoever fills in Sheet 1 can copy-paste a valid code instead of typing one
// from memory -- the exact mistake-prevention the user asked for.
export function exportProductLocationAssignmentsExcel(products = [], customersById = new Map(), locations = [], filename = 'product-location-assignments.xlsx') {
  downloadExcelWorkbookMultiSheet(
    [
      {
        name: DATA_SHEET_NAME,
        rows: products.map((p) => mapDepositLineToAssignmentRow(p, customersById)),
        headers: PRODUCT_LOCATION_EXCEL_HEADERS,
        columnWidths: [16, 28, 22, 20, 32, 14, 55],
      },
      {
        name: LOCATION_REFERENCE_SHEET_NAME,
        rows: buildLocationReferenceRows(locations),
        headers: LOCATION_REFERENCE_HEADERS,
        columnWidths: [14, 24, 10],
      },
    ],
    filename,
  );
}

export function downloadProductLocationAssignmentTemplate(locations = [], filename = 'product-location-assignment-template.xlsx') {
  const sampleLocationCode = locations[0]?.code ?? '42-L-05';
  downloadExcelWorkbookMultiSheet(
    [
      {
        name: DATA_SHEET_NAME,
        rows: [
          {
            customer_code: 'CUST-001',
            customer_name: 'ตัวอย่างชื่อลูกค้า',
            tracking_code: 'FR260101001',
            customer_product_code: '10154-10',
            product_name: 'ตัวอย่างชื่อสินค้า',
            location_code: sampleLocationCode,
            note: '',
          },
        ],
        headers: PRODUCT_LOCATION_EXCEL_HEADERS,
        columnWidths: [16, 28, 22, 20, 32, 14, 55],
      },
      {
        name: LOCATION_REFERENCE_SHEET_NAME,
        rows: buildLocationReferenceRows(locations),
        headers: LOCATION_REFERENCE_HEADERS,
        columnWidths: [14, 24, 10],
      },
    ],
    filename,
  );
}

// Pure row-mapping/validation, kept separate from readExcelFile so it can be
// unit-tested directly on plain row objects (see
// tests/unit/product-location-assignment-excel-utils.test.js) -- mirrors
// mapImportedRowsToDepositLines's shape: good and bad rows both survive in
// their own array, one bad row never drops the rest of the file.
export function mapImportedRowsToLocationAssignments(rawRows = []) {
  const errors = [];
  const rows = [];

  rawRows.forEach((row) => {
    const customerCode = String(row.customer_code ?? '').trim();
    const trackingCode = String(row.tracking_code ?? '').trim();

    if (!customerCode) {
      errors.push({ row: row.__row, reason: 'customer_code ไม่ระบุ' });
      return;
    }
    if (!trackingCode) {
      errors.push({ row: row.__row, reason: 'tracking_code ไม่ระบุ' });
      return;
    }

    // Blank location means leave this lot untouched.
    const locationCode = String(row.location_code ?? '').trim();

    rows.push({
      __row: row.__row,
      customer_code: customerCode,
      tracking_code: trackingCode,
      location_code: locationCode,
    });
  });

  return { rows, errors };
}

export async function parseProductLocationAssignmentFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const missingHeaders = ['customer_code', 'tracking_code'].filter((key) => !headers.includes(key));
  if (missingHeaders.length) {
    return { rows: [], errors: [{ row: null, reason: `คอลัมน์ที่ขาดหายไป: ${missingHeaders.join(', ')}` }] };
  }

  return mapImportedRowsToLocationAssignments(rows);
}

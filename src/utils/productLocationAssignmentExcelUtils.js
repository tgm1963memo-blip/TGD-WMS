import { downloadExcelWorkbookMultiSheet, readExcelFile } from './excelFileUtils.js';

export const PRODUCT_LOCATION_EXCEL_HEADERS = [
  'customer_code',
  'customer_name',
  'customer_product_code',
  'product_name',
  'location_code',
];

// customer_name and product_name are reference-only -- ignored on import,
// there purely so whoever fills in location_code can tell which product row
// they're looking at without cross-referencing the catalog separately.
const LOCATION_REFERENCE_HEADERS = ['location_code', 'section', 'capacity'];
const LOCATION_REFERENCE_SHEET_NAME = 'รหัส Location ที่มีในระบบ';
const DATA_SHEET_NAME = 'Products';

function buildLocationReferenceRows(locations = []) {
  return locations.map((loc) => ({
    location_code: loc.code,
    section: loc.sectionName ?? loc.sectionCode ?? '',
    capacity: loc.capacity ?? '',
  }));
}

export function mapProductToAssignmentRow(product = {}, customersById = new Map()) {
  const customer = customersById.get(product.customer_id);
  return {
    customer_code: customer?.customer_code ?? '',
    customer_name: customer?.customer_name ?? '',
    customer_product_code: product.customer_product_code ?? '',
    product_name: product.product_name ?? '',
    location_code: product.locationCode ?? '',
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
        rows: products.map((p) => mapProductToAssignmentRow(p, customersById)),
        headers: PRODUCT_LOCATION_EXCEL_HEADERS,
        columnWidths: [16, 28, 20, 32, 14],
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
            customer_product_code: '10154-10',
            product_name: 'ตัวอย่างชื่อสินค้า',
            location_code: sampleLocationCode,
          },
        ],
        headers: PRODUCT_LOCATION_EXCEL_HEADERS,
        columnWidths: [16, 28, 20, 32, 14],
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
    const customerProductCode = String(row.customer_product_code ?? '').trim();

    if (!customerCode) {
      errors.push({ row: row.__row, reason: 'customer_code ไม่ระบุ' });
      return;
    }
    if (!customerProductCode) {
      errors.push({ row: row.__row, reason: 'customer_product_code ไม่ระบุ' });
      return;
    }

    // Blank is valid here -- it means "clear this product's assigned
    // location", not "skip this row". Only a NON-blank code that fails to
    // resolve server-side becomes an error (see the RPC).
    const locationCode = String(row.location_code ?? '').trim();

    rows.push({
      customer_code: customerCode,
      customer_product_code: customerProductCode,
      location_code: locationCode,
    });
  });

  return { rows, errors };
}

export async function parseProductLocationAssignmentFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const missingHeaders = ['customer_code', 'customer_product_code'].filter((key) => !headers.includes(key));
  if (missingHeaders.length) {
    return { rows: [], errors: [{ row: null, reason: `คอลัมน์ที่ขาดหายไป: ${missingHeaders.join(', ')}` }] };
  }

  return mapImportedRowsToLocationAssignments(rows);
}

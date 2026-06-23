import { downloadExcelRows, readExcelFile } from './excelFileUtils.js';

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

export function downloadCustomerDepositLineTemplate(catalogProducts = [], filename = 'customer-deposit-lines-template.xlsx') {
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
        mfg_date: '',
        exp_date: '',
        line_note: 'ตัวอย่างหมายเหตุ',
      }];
  downloadExcelRows(rows, CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS, filename, 'DepositLines');
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
      mfg_date: String(row.mfg_date ?? '').trim(),
      exp_date: String(row.exp_date ?? '').trim(),
      line_note: String(row.line_note ?? '').trim(),
    });
  });

  return { lines, errors };
}

const REQUIRED_IMPORT_HEADERS = ['customer_product_code'];

export async function parseCustomerDepositLineImportFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const missingHeaders = REQUIRED_IMPORT_HEADERS.filter((header) => !headers.includes(header));
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

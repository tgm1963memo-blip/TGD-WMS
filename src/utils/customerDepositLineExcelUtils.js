import { downloadExcelRows, formatExcelDate, readExcelFile } from './excelFileUtils.js';
import { resolveBarcodeCode } from './customerProductExcelUtils.js';

export const CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS = [
  'customer_product_code',
  'lot_no',
  'mfg_date',
  'exp_date',
  'expected_qty',
  'expected_boxes',
  'expected_weight',
];

export function mapDepositLineToExcelRow(line = {}) {
  return {
    customer_product_code: line.customer_product_code ?? '',
    lot_no: line.lot_no ?? '',
    mfg_date: line.mfg_date ?? '',
    exp_date: line.exp_date ?? '',
    expected_qty: line.expected_qty ?? '',
    expected_boxes: line.expected_boxes ?? '',
    expected_weight: line.expected_weight ?? '',
  };
}

export function downloadCustomerDepositLineTemplate(filename = 'customer-deposit-lines-template.xlsx') {
  downloadExcelRows([{
    customer_product_code: 'SAMPLE-001',
    lot_no: 'LOT-001',
    mfg_date: '2026-01-01',
    exp_date: '2027-01-01',
    expected_qty: '10',
    expected_boxes: '2',
    expected_weight: '50',
  }], CUSTOMER_DEPOSIT_LINE_EXCEL_HEADERS, filename, 'DepositLines');
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

    const expectedQty = String(row.expected_qty ?? '').trim();
    if (!expectedQty || Number(expectedQty) <= 0) {
      errors.push(`Row ${row.__row}: expected_qty must be greater than 0.`);
      return;
    }

    lines.push({
      key: startKey + lines.length,
      catalog_product_id: catalog.id,
      customer_product_code: catalog.customer_product_code ?? customerProductCode,
      product_code: resolveBarcodeCode(catalog.customer_product_code, catalog.internal_product_code),
      product_name: catalog.product_name ?? '',
      argent_type: catalog.argent_type ?? 'NON_ARGENT',
      temperature_type: catalog.temperature_type ?? 'FROZEN',
      lot_no: String(row.lot_no ?? '').trim(),
      mfg_date: formatExcelDate(row.mfg_date),
      exp_date: formatExcelDate(row.exp_date),
      expected_qty: expectedQty,
      expected_boxes: String(row.expected_boxes ?? '').trim(),
      expected_weight: String(row.expected_weight ?? '').trim(),
    });
  });

  return { lines, errors };
}

export async function parseCustomerDepositLineImportFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const missingHeaders = ['customer_product_code', 'expected_qty'].filter((key) => !headers.includes(key));
  if (missingHeaders.length) {
    return { rows: [], errors: [`Missing required columns: ${missingHeaders.join(', ')}`] };
  }
  return { rows, errors: [] };
}

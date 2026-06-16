import { buildCsv, downloadCsvContent, parseCsvText } from './csvFileUtils.js';
import { resolveBarcodeCode } from './customerProductCsvUtils.js';

export const CUSTOMER_DEPOSIT_LINE_CSV_HEADERS = [
  'customer_product_code',
  'lot_no',
  'expected_qty',
  'expected_boxes',
  'expected_weight',
  'temperature_type',
];

const TEMPERATURE_TYPES = new Set(['FROZEN', 'CHILLED', 'AMBIENT']);

export function mapDepositLineToCsvRow(line = {}) {
  return {
    customer_product_code: line.customer_product_code ?? '',
    lot_no: line.lot_no ?? '',
    expected_qty: line.expected_qty ?? '',
    expected_boxes: line.expected_boxes ?? '',
    expected_weight: line.expected_weight ?? '',
    temperature_type: line.temperature_type ?? '',
  };
}

export function downloadCustomerDepositLineTemplate(filename = 'customer-deposit-lines-template.csv') {
  const csv = buildCsv(CUSTOMER_DEPOSIT_LINE_CSV_HEADERS, [{
    customer_product_code: 'SAMPLE-001',
    lot_no: 'LOT-001',
    expected_qty: '10',
    expected_boxes: '2',
    expected_weight: '50',
    temperature_type: 'CHILLED',
  }]);
  downloadCsvContent(csv, filename);
}

export function exportCustomerDepositLinesCsv(lines = [], filename = 'customer-deposit-lines.csv') {
  const csv = buildCsv(
    CUSTOMER_DEPOSIT_LINE_CSV_HEADERS,
    lines.map(mapDepositLineToCsvRow),
  );
  downloadCsvContent(csv, filename);
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
      errors.push(`Row ${row.__row}: product code "${customerProductCode}" is not in your catalog.`);
      return;
    }

    const expectedQty = String(row.expected_qty ?? '').trim();
    if (!expectedQty || Number(expectedQty) <= 0) {
      errors.push(`Row ${row.__row}: expected_qty must be greater than 0.`);
      return;
    }

    const temperatureType = String(row.temperature_type ?? catalog.temperature_type ?? 'FROZEN').trim().toUpperCase();
    if (!TEMPERATURE_TYPES.has(temperatureType)) {
      errors.push(`Row ${row.__row}: temperature_type must be FROZEN, CHILLED, or AMBIENT.`);
      return;
    }

    lines.push({
      key: startKey + lines.length,
      catalog_product_id: catalog.id,
      customer_product_code: catalog.customer_product_code ?? customerProductCode,
      product_code: resolveBarcodeCode(catalog.customer_product_code, catalog.internal_product_code),
      product_name: catalog.product_name ?? '',
      lot_no: String(row.lot_no ?? '').trim(),
      expected_qty: expectedQty,
      expected_boxes: String(row.expected_boxes ?? '').trim(),
      expected_weight: String(row.expected_weight ?? '').trim(),
      temperature_type: temperatureType,
    });
  });

  return { lines, errors };
}

export function parseCustomerDepositLineImportRows(text) {
  const { headers, rows } = parseCsvText(text);
  const missingHeaders = ['customer_product_code', 'expected_qty'].filter((key) => !headers.includes(key));

  if (missingHeaders.length) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
    };
  }

  return { rows, errors: [] };
}

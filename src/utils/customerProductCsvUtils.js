import { buildCsv, downloadCsvContent, parseCsvText } from './csvFileUtils.js';

export const CUSTOMER_PRODUCT_CSV_HEADERS = [
  'customer_product_code',
  'product_name',
  'barcode_code',
  'uom',
  'temperature_type',
  'note',
];

const TEMPERATURE_TYPES = new Set(['FROZEN', 'CHILLED', 'AMBIENT']);

export function resolveBarcodeCode(customerProductCode, barcodeCode) {
  const productCode = String(customerProductCode ?? '').trim();
  const barcode = String(barcodeCode ?? '').trim();
  return barcode || productCode;
}

export function normalizeCatalogBarcode(row = {}) {
  const customerCode = row.customer_product_code ?? '';
  const stored = row.internal_product_code ?? '';
  return stored || customerCode;
}

export function mapProductToCsvRow(product = {}) {
  return {
    customer_product_code: product.customer_product_code ?? '',
    product_name: product.product_name ?? '',
    barcode_code: normalizeCatalogBarcode(product),
    uom: product.uom ?? '',
    temperature_type: product.temperature_type ?? 'FROZEN',
    note: product.note ?? '',
  };
}

export function downloadCustomerProductTemplate(filename = 'customer-products-template.csv') {
  const csv = buildCsv(CUSTOMER_PRODUCT_CSV_HEADERS, [{
    customer_product_code: 'SAMPLE-001',
    product_name: 'Sample product name',
    barcode_code: '',
    uom: 'KG',
    temperature_type: 'FROZEN',
    note: '',
  }]);
  downloadCsvContent(csv, filename);
}

export function exportCustomerProductsCsv(products = [], filename = 'customer-products.csv') {
  const csv = buildCsv(
    CUSTOMER_PRODUCT_CSV_HEADERS,
    products.map(mapProductToCsvRow),
  );
  downloadCsvContent(csv, filename);
}

export function parseCustomerProductImportRows(text) {
  const { headers, rows } = parseCsvText(text);
  const missingHeaders = CUSTOMER_PRODUCT_CSV_HEADERS.filter((key) => (
    key !== 'note' && key !== 'barcode_code' && key !== 'uom' && !headers.includes(key)
  ));

  if (missingHeaders.length) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
    };
  }

  const parsed = [];
  const errors = [];

  rows.forEach((row) => {
    const customerProductCode = String(row.customer_product_code ?? '').trim();
    const productName = String(row.product_name ?? '').trim();
    const temperatureType = String(row.temperature_type ?? 'FROZEN').trim().toUpperCase() || 'FROZEN';

    if (!customerProductCode || !productName) {
      errors.push(`Row ${row.__row}: customer_product_code and product_name are required.`);
      return;
    }

    if (!TEMPERATURE_TYPES.has(temperatureType)) {
      errors.push(`Row ${row.__row}: temperature_type must be FROZEN, CHILLED, or AMBIENT.`);
      return;
    }

    parsed.push({
      customerProductCode,
      productName,
      internalProductCode: resolveBarcodeCode(customerProductCode, row.barcode_code),
      uom: String(row.uom ?? '').trim(),
      temperatureType,
      note: String(row.note ?? '').trim(),
    });
  });

  return { rows: parsed, errors };
}

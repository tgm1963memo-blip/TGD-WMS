import { downloadExcelRows, formatExcelDate, readExcelFile } from './excelFileUtils.js';

export const CUSTOMER_PRODUCT_EXCEL_HEADERS = [
  'customer_product_code',
  'customer_id',
  'customer_name',
  'product_name',
  'barcode_code',
  'uom',
  'temperature_type',
  'argent_type',
  'storage_charge_basis',
  'note',
];

const TEMPERATURE_TYPES = new Set(['FROZEN', 'CHILLED', 'AMBIENT']);
const ARGENT_TYPES = new Set(['ARGENT', 'NON_ARGENT']);
const CHARGE_BASIS = new Set(['WEIGHT', 'PALLET']);

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

export function mapProductToExcelRow(product = {}) {
  return {
    customer_product_code: product.customer_product_code ?? '',
    customer_id: product.customer_id ?? '',
    customer_name: product.customer_name ?? '',
    product_name: product.product_name ?? '',
    barcode_code: normalizeCatalogBarcode(product),
    uom: product.uom ?? '',
    temperature_type: product.temperature_type ?? 'FROZEN',
    argent_type: product.argent_type ?? 'NON_ARGENT',
    storage_charge_basis: product.storage_charge_basis ?? 'WEIGHT',
    note: product.note ?? '',
  };
}

export function downloadCustomerProductTemplate(customer = null, filename = 'customer-products-template.xlsx') {
  downloadExcelRows(
    [
      {
        customer_product_code: 'SAMPLE-001',
        customer_id: customer?.id ?? '',
        customer_name: customer ? `${customer.customer_code ?? ''} — ${customer.customer_name ?? ''}`.trim().replace(/^—\s*/, '') : '',
        product_name: 'Sample product name',
        barcode_code: '',
        uom: 'KG',
        temperature_type: 'FROZEN',
        argent_type: 'NON_ARGENT',
        storage_charge_basis: 'WEIGHT',
        note: '',
      },
    ],
    CUSTOMER_PRODUCT_EXCEL_HEADERS,
    filename,
    'Products',
  );
}

export function exportCustomerProductsExcel(products = [], filename = 'customer-products.xlsx') {
  downloadExcelRows(
    products.map(mapProductToExcelRow),
    CUSTOMER_PRODUCT_EXCEL_HEADERS,
    filename,
    'Products',
  );
}

export async function parseCustomerProductImportFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const missingHeaders = ['customer_product_code', 'product_name', 'customer_id'].filter((key) => !headers.includes(key));
  if (missingHeaders.length) {
    return { rows: [], errors: [`Missing required columns: ${missingHeaders.join(', ')}`] };
  }

  const errors = [];
  const parsed = [];

  rows.forEach((row) => {
    const customerProductCode = String(row.customer_product_code ?? '').trim();
    const productName = String(row.product_name ?? '').trim();

    if (!customerProductCode) {
      errors.push(`Row ${row.__row}: customer_product_code is required.`);
      return;
    }
    if (!productName) {
      errors.push(`Row ${row.__row}: product_name is required.`);
      return;
    }

    const temperatureType = String(row.temperature_type ?? 'FROZEN').trim().toUpperCase();
    const argentType = String(row.argent_type ?? 'NON_ARGENT').trim().toUpperCase();
    const chargeBasis = String(row.storage_charge_basis ?? 'WEIGHT').trim().toUpperCase();

    if (!TEMPERATURE_TYPES.has(temperatureType)) {
      errors.push(`Row ${row.__row}: temperature_type must be FROZEN, CHILLED, or AMBIENT.`);
      return;
    }
    if (!ARGENT_TYPES.has(argentType)) {
      errors.push(`Row ${row.__row}: argent_type must be ARGENT or NON_ARGENT.`);
      return;
    }
    if (!CHARGE_BASIS.has(chargeBasis)) {
      errors.push(`Row ${row.__row}: storage_charge_basis must be WEIGHT or PALLET.`);
      return;
    }

    parsed.push({
      customerProductCode,
      customerId: String(row.customer_id ?? '').trim(),
      productName,
      internalProductCode: resolveBarcodeCode(customerProductCode, row.barcode_code),
      uom: String(row.uom ?? '').trim(),
      temperatureType,
      argentType,
      storageChargeBasis: chargeBasis,
      note: String(row.note ?? '').trim(),
    });
  });

  return { rows: parsed, errors };
}

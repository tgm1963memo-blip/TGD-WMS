import { downloadExcelRows, readExcelFile } from './excelFileUtils.js';

export const STORAGE_RATE_EXCEL_HEADERS = [
  'customer_code',
  'customer_product_code',
  'product_name',
  'service_type',
  'rate',
  'unit_basis',
  'currency',
  'note',
  'is_active',
];

const SERVICE_TYPE_VALUES = new Set(['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'OTHER']);
const UNIT_BASIS_VALUES = new Set(['PER_KG', 'PER_UNIT', 'PER_PALLET', 'PER_TRIP', 'PER_DAY', 'FLAT']);

export function mapRateRowToExcelRow(row = {}) {
  return {
    customer_code: row.customer_code ?? '',
    customer_product_code: row.customer_product_code ?? '',
    product_name: row.product_name ?? '',
    service_type: row.service_type ?? '',
    rate: row.rate ?? '',
    unit_basis: row.unit_basis ?? '',
    currency: row.currency ?? 'THB',
    note: row.note ?? '',
    is_active: row.is_active === false ? 'FALSE' : 'TRUE',
  };
}

export function downloadStorageRateTemplate(filename = 'storage-rate-template.xlsx') {
  downloadExcelRows(
    [{
      customer_code: 'CUST-001',
      customer_product_code: 'SAMPLE-001',
      product_name: 'Sample product name',
      service_type: 'STORAGE',
      rate: '2.50',
      unit_basis: 'PER_KG',
      currency: 'THB',
      note: '',
      is_active: 'TRUE',
    }],
    STORAGE_RATE_EXCEL_HEADERS,
    filename,
    'Storage Rates',
  );
}

export function exportStorageRatesExcel(rows = [], filename = 'storage-rates.xlsx') {
  downloadExcelRows(rows.map(mapRateRowToExcelRow), STORAGE_RATE_EXCEL_HEADERS, filename, 'Storage Rates');
}

// Keyed by "CUSTOMER_CODE::CUSTOMER_PRODUCT_CODE" (both upper-cased) so the
// import can resolve each spreadsheet row back to a customer_product_id
// without requiring the user to know/paste internal UUIDs.
export function buildStorageRateLookupMap(customerProducts = []) {
  const map = new Map();
  customerProducts.forEach((cp) => {
    const code = cp.customer_code ?? cp.tgd_customers?.customer_code;
    if (!code || !cp.customer_product_code) return;
    map.set(`${String(code).toUpperCase()}::${String(cp.customer_product_code).toUpperCase()}`, cp);
  });
  return map;
}

export async function parseStorageRateImportFile(file, lookupMap = new Map()) {
  const { headers, rows } = await readExcelFile(file);
  const required = ['customer_code', 'customer_product_code', 'service_type', 'rate', 'unit_basis'];
  const missingHeaders = required.filter((key) => !headers.includes(key));
  if (missingHeaders.length) {
    return { rows: [], errors: [`Missing required columns: ${missingHeaders.join(', ')}`] };
  }

  const errors = [];
  const parsed = [];

  rows.forEach((row) => {
    const customerCode = String(row.customer_code ?? '').trim();
    const productCode = String(row.customer_product_code ?? '').trim();
    const serviceType = String(row.service_type ?? '').trim().toUpperCase();
    const unitBasis = String(row.unit_basis ?? '').trim().toUpperCase();
    const rateRaw = String(row.rate ?? '').trim();

    if (!customerCode || !productCode) {
      errors.push(`Row ${row.__row}: customer_code and customer_product_code are required.`);
      return;
    }
    if (!SERVICE_TYPE_VALUES.has(serviceType)) {
      errors.push(`Row ${row.__row}: service_type must be one of ${[...SERVICE_TYPE_VALUES].join(', ')}.`);
      return;
    }
    if (!UNIT_BASIS_VALUES.has(unitBasis)) {
      errors.push(`Row ${row.__row}: unit_basis must be one of ${[...UNIT_BASIS_VALUES].join(', ')}.`);
      return;
    }

    const rate = Number(rateRaw);
    if (!Number.isFinite(rate) || rate < 0) {
      errors.push(`Row ${row.__row}: rate must be a number >= 0.`);
      return;
    }

    const lookupKey = `${customerCode.toUpperCase()}::${productCode.toUpperCase()}`;
    const match = lookupMap.get(lookupKey);
    if (!match) {
      errors.push(`Row ${row.__row}: no product found for customer_code "${customerCode}" + customer_product_code "${productCode}".`);
      return;
    }

    const isActiveRaw = String(row.is_active ?? 'TRUE').trim().toUpperCase();
    const isActive = !['FALSE', '0', 'NO'].includes(isActiveRaw);

    parsed.push({
      customerProductId: match.id,
      serviceType,
      rate,
      unitBasis,
      currency: String(row.currency ?? 'THB').trim() || 'THB',
      note: String(row.note ?? '').trim() || null,
      isActive,
    });
  });

  return { rows: parsed, errors };
}

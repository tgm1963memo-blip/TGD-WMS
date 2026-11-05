import { downloadExcelRows, formatExcelDate, readExcelFile } from './excelFileUtils.js';
import { resolveR3CarcassTypeCode } from './r3PermitComparisonUtils.js';

export const CUSTOMER_PRODUCT_EXCEL_HEADERS = [
  'customer_product_code',
  'product_name',
  'barcode_code',
  'uom',
  'pack_weight_kg',
  'temperature_type',
  'argent_type',
  'storage_charge_basis',
  'product_category',
  'note',
  'r3_carcass_type',
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

export function mapProductToExcelRow(product = {}, r3Types = []) {
  return {
    customer_product_code: product.customer_product_code ?? '',
    product_name: product.product_name ?? '',
    barcode_code: normalizeCatalogBarcode(product),
    uom: product.uom ?? '',
    pack_weight_kg: product.pack_weight_kg ?? '',
    temperature_type: product.temperature_type ?? 'FROZEN',
    argent_type: product.argent_type ?? 'NON_ARGENT',
    storage_charge_basis: product.storage_charge_basis ?? 'WEIGHT',
    product_category: product.product_category ?? '',
    note: product.note ?? '',
    // Thai label, not the code — readable for customers, and the importer
    // accepts either.
    r3_carcass_type: r3Types.find((t) => t.code === product.r3_carcass_type_code)?.label_th
      ?? product.r3_carcass_type_code ?? '',
  };
}

export function downloadCustomerProductTemplate(customer = null, filename = 'customer-products-template.xlsx') {
  downloadExcelRows(
    [
      {
        customer_product_code: 'SAMPLE-001',
        product_name: 'Sample product name',
        barcode_code: '',
        uom: 'KG',
        pack_weight_kg: '1.500',
        temperature_type: 'FROZEN',
        argent_type: 'NON_ARGENT',
        storage_charge_basis: 'WEIGHT',
        product_category: '',
        note: '',
        r3_carcass_type: '',
      },
    ],
    CUSTOMER_PRODUCT_EXCEL_HEADERS,
    filename,
    'Products',
  );
}

export function exportCustomerProductsExcel(products = [], filename = 'customer-products.xlsx', r3Types = []) {
  downloadExcelRows(
    products.map((p) => mapProductToExcelRow(p, r3Types)),
    CUSTOMER_PRODUCT_EXCEL_HEADERS,
    filename,
    'Products',
  );
}

// r3CarcassTypeCode is null for a blank cell — callers keep the product's
// existing value in that case rather than clearing it.
export async function parseCustomerProductImportFile(file, r3Types = []) {
  const { headers, rows } = await readExcelFile(file);
  const missingHeaders = ['customer_product_code', 'product_name'].filter((key) => !headers.includes(key));
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

    const packWeightRaw = String(row.pack_weight_kg ?? '').trim();
    let packWeightKg = null;
    if (packWeightRaw) {
      const parsedWeight = Number(packWeightRaw);
      if (Number.isNaN(parsedWeight) || parsedWeight < 0) {
        errors.push(`Row ${row.__row}: pack_weight_kg must be a number >= 0.`);
        return;
      }
      packWeightKg = parsedWeight;
    }

    const r3Raw = String(row.r3_carcass_type ?? '').trim();
    const r3CarcassTypeCode = resolveR3CarcassTypeCode(r3Raw, r3Types);
    if (r3Raw && !r3CarcassTypeCode) {
      errors.push(`Row ${row.__row}: r3_carcass_type "${r3Raw}" is not a known ร.3 carcass type.`);
      return;
    }

    parsed.push({
      customerProductCode,
      productName,
      internalProductCode: resolveBarcodeCode(customerProductCode, row.barcode_code),
      uom: String(row.uom ?? '').trim(),
      packWeightKg,
      temperatureType,
      argentType,
      storageChargeBasis: chargeBasis,
      productCategory: String(row.product_category ?? '').trim(),
      note: String(row.note ?? '').trim(),
      r3CarcassTypeCode,
    });
  });

  return { rows: parsed, errors };
}

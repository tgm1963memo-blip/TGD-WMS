import { downloadExcelRows, formatExcelDate, readExcelFile } from './excelFileUtils.js';

export const OPENING_BALANCE_HEADERS = [
  'customer_product_code',
  'product_name',
  'lot_no',
  'mfg_date',
  'expiry_date',
  'qty_boxes',
  'weight_kg',
  'note',
  'location_code',
];

const SAMPLE_ROWS = [
  {
    customer_product_code: '10154-10',
    product_name: 'หมูสามชั้นแช่แข็ง',
    lot_no: 'LOT-2025-001',
    mfg_date: '2025-01-15',
    expiry_date: '2026-01-15',
    qty_boxes: 100,
    weight_kg: 500,
    note: '',
    location_code: '',
  },
  {
    customer_product_code: '10154-10',
    product_name: 'หมูสามชั้นแช่แข็ง',
    lot_no: 'LOT-2025-002',
    mfg_date: '2025-02-01',
    expiry_date: '2026-02-01',
    qty_boxes: 80,
    weight_kg: 400,
    note: '',
    location_code: '',
  },
  {
    customer_product_code: '20231-22',
    product_name: 'ซี่โครงหมูแช่แข็ง',
    lot_no: 'LOT-2025-003',
    mfg_date: '2025-01-20',
    expiry_date: '2026-01-20',
    qty_boxes: 65,
    weight_kg: 325,
    note: 'นำเข้าจากเยอรมัน',
    location_code: '',
  },
];

export function downloadOpeningBalanceTemplate(filename = 'opening-balance-template.xlsx') {
  downloadExcelRows(SAMPLE_ROWS, OPENING_BALANCE_HEADERS, filename, 'Opening Balance');
}

export async function parseOpeningBalanceFile(file) {
  const { headers, rows } = await readExcelFile(file);

  const required = ['customer_product_code', 'qty_boxes'];
  const missing = required.filter((k) => !headers.includes(k));
  if (missing.length) {
    return { rows: [], errors: [`คอลัมน์ที่ขาดหายไป: ${missing.join(', ')}`] };
  }

  const errors = [];
  const parsed = [];

  rows.forEach((row) => {
    const productCode = String(row.customer_product_code ?? '').trim();
    const qty = Number(String(row.qty_boxes ?? '').trim());

    if (!productCode) {
      errors.push(`แถว ${row.__row}: customer_product_code ไม่ระบุ`);
      return;
    }
    if (!qty || qty <= 0) {
      errors.push(`แถว ${row.__row}: qty_boxes ต้องมากกว่า 0`);
      return;
    }

    const locationCode = String(row.location_code ?? '').trim() || null;

    parsed.push({
      customer_product_code: productCode,
      product_name: String(row.product_name ?? productCode).trim(),
      lot_no: String(row.lot_no ?? '').trim() || null,
      mfg_date: formatExcelDate(row.mfg_date) || null,
      expiry_date: formatExcelDate(row.expiry_date) || null,
      qty_boxes: qty,
      weight_kg: Number(String(row.weight_kg ?? '0').trim()) || 0,
      note: String(row.note ?? '').trim() || null,
      location_code: locationCode,
    });
  });

  return { rows: parsed, errors };
}

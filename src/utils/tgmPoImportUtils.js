import { readExcelFile } from './excelFileUtils.js';
import { calcBoxesFromTotalWeight, PACK_ENTRY_MODES } from './customerDepositPackCalcUtils.js';
import { parseDepositExcelDate } from './customerDepositLineExcelUtils.js';

// TGM-only deposit import: TGM sends the purchase order exported from B-Plus
// (sheet "BplusData") instead of our own deposit template. Nothing here is
// used for any other customer — the page only offers the button when the
// selected customer's code is in TGM_CUSTOMER_CODES.

export const TGM_CUSTOMER_CODES = ['C002'];

// B-Plus supplier code (AP_CODE) -> the sup code printed in TGM's lot, from
// TGM's supplier table. One B-Plus code can cover several plants with their
// own sup codes (Betagro Lopburi / Nakhon Pathom share 1-BT-G); those list
// the options and the user picks the plant in the review dialog. An unmapped
// supplier still imports, with a lot of just "Lot <day>" and a warning.
export const TGM_SUPPLIER_LOT_CODES = {
  '1-BT-G': [
    { code: '1', label: 'เบทาโกร ลพบุรี' },
    { code: '49', label: 'เบทาโกร นครปฐม' },
  ],
  'KA-N': '4', // กาญจนา
  'N-VC-M': '38', // VC
  '1-CP-F': '24', // CPF
  'SP-F': '30', // สามพราน
  'FM-E': '2', // เฟรชมีท
  '1-TP-S': '39', // Thaifood
  '1-TF-P': '39', // Thaifood
  '1-P8-1': '48', // P818
  '1-SM-M': '52', // สมายมีท
  '1-MM-T': '59', // หมูเตตัส
  'BB-T': '18', // เบทเทอร์
  '1-FA-F': '44', // F&F
  'GF-P': '25', // GFPT
  'BR-F': '35', // Tyson
  'N-SF-I': '34', // Sunfood
  '1-BF-B': '54', // Bfood
  '1-HA-P': '57', // แฮปปี้แลนด์
  '1-PB-P': '42', // ประกอบบีฟ
};

// The sup code for a PO row's supplier: the mapped code, or for a B-Plus code
// shared by several plants, the plant chosen in supplierChoices ('' until then).
export function resolveSupCode(apCode, supplierLotCodes = TGM_SUPPLIER_LOT_CODES, supplierChoices = {}) {
  const key = String(apCode ?? '').trim().toUpperCase();
  const mapped = supplierLotCodes[key];
  if (Array.isArray(mapped)) {
    const chosen = supplierChoices[key];
    return mapped.some((option) => option.code === chosen) ? chosen : '';
  }
  return mapped ?? '';
}

const REQUIRED_PO_COLUMNS = ['SKU_CODE', 'TRD_QTY', 'TRH_SHIP_DATE'];
const KG_UNITS = ['KG', 'KGS', 'กก', 'กก.', 'กิโลกรัม'];

export function isTgmCustomerCode(customerCode) {
  return TGM_CUSTOMER_CODES.includes(String(customerCode ?? '').trim().toUpperCase());
}

// B-Plus writes amounts as currency text, e.g. "$1,390.00 ".
export function parseBplusAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').replace(/[$,\s]/g, '');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// 1-366 for an ISO date (YYYY-MM-DD); computed in UTC so the local timezone
// can't shift it by a day.
export function dayOfYear(isoDate) {
  const match = String(isoDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const date = Date.UTC(year, Number(match[2]) - 1, Number(match[3]));
  return Math.round((date - Date.UTC(year, 0, 1)) / 86400000) + 1;
}

// "Lot 306 Sup 39"; without a sup code just "Lot 306".
export function formatTgmLot(day, supCode) {
  const lot = `Lot ${String(day).padStart(3, '0')}`;
  const sup = String(supCode ?? '').trim();
  return sup ? `${lot} Sup ${sup}` : lot;
}

export async function parseTgmPoFile(file) {
  const { headers, rows } = await readExcelFile(file);
  const headerSet = new Set(headers.map((h) => h.toUpperCase()));
  const missing = REQUIRED_PO_COLUMNS.filter((column) => !headerSet.has(column));
  if (missing.length) {
    return {
      rows: [],
      errors: [`ไฟล์นี้ไม่ใช่ PO จาก B-Plus — ไม่พบคอลัมน์ ${missing.join(', ')}`],
    };
  }
  return { rows, errors: [] };
}

function cell(row, key) {
  return String(row[key] ?? '').trim();
}

// Returns one preview entry per PO row (for the review dialog) plus the
// deposit lines built from the usable ones, in the same shape
// mapImportedRowsToDepositLines produces.
export function mapTgmPoRowsToDepositLines(rows, catalogProducts = [], startKey = 1, supplierLotCodes = TGM_SUPPLIER_LOT_CODES, supplierChoices = {}) {
  const catalogByCode = new Map(
    catalogProducts.map((product) => [String(product.customer_product_code ?? '').trim().toUpperCase(), product]),
  );

  const preview = [];
  const lines = [];
  // Shared B-Plus codes present in this file, for the plant picker.
  const supplierPicks = new Map();

  rows.forEach((row) => {
    const sku = cell(row, 'SKU_CODE');
    if (!sku && !cell(row, 'TRD_QTY')) return;

    const poNo = cell(row, 'DI_REF');
    const apCode = cell(row, 'AP_CODE');
    const mappedSup = supplierLotCodes[apCode.toUpperCase()];
    const needsPick = Array.isArray(mappedSup);
    if (needsPick) supplierPicks.set(apCode.toUpperCase(), mappedSup);
    const supCode = resolveSupCode(apCode, supplierLotCodes, supplierChoices);
    const qtyKg = parseBplusAmount(row.TRD_QTY);
    const shipDate = parseDepositExcelDate(row.TRH_SHIP_DATE);
    const day = shipDate.valid ? dayOfYear(shipDate.date) : null;
    const lot = day ? formatTgmLot(day, supCode) : '';
    const unit = cell(row, 'TRD_UTQNAME');
    const entry = {
      row: row.__row,
      poNo,
      sku,
      apCode,
      supCode,
      qtyKg,
      unit,
      shipDate: shipDate.date,
      lot,
      productName: '',
      weightPerBox: '',
      boxes: '',
      status: 'ok',
      messages: [],
    };
    preview.push(entry);

    const catalog = catalogByCode.get(sku.toUpperCase());
    if (!sku) {
      entry.status = 'skip';
      entry.messages.push('ไม่มีรหัสสินค้า (SKU_CODE)');
      return;
    }
    if (!catalog) {
      entry.status = 'skip';
      entry.messages.push('ไม่พบรหัสสินค้านี้ในแคตตาล็อกของ TGM');
      return;
    }
    if (!(qtyKg > 0)) {
      entry.status = 'skip';
      entry.messages.push('จำนวน (TRD_QTY) ต้องมากกว่า 0');
      return;
    }
    if (!day) {
      entry.status = 'skip';
      entry.messages.push('วันที่ส่ง (TRH_SHIP_DATE) ไม่ถูกต้อง จึงคำนวณ Lot ไม่ได้');
      return;
    }

    const weightPerBox = Number(catalog.pack_weight_kg) > 0 ? String(catalog.pack_weight_kg) : '';
    const expectedWeight = String(qtyKg);
    const expectedBoxes = weightPerBox ? calcBoxesFromTotalWeight(expectedWeight, weightPerBox) : '';
    entry.productName = catalog.product_name ?? '';
    entry.weightPerBox = weightPerBox;
    entry.boxes = expectedBoxes;

    if (!supCode) {
      entry.messages.push(needsPick
        ? `เลือกโรงงานของผู้ขาย "${apCode}" ด้านบน เพื่อเติมรหัส sup`
        : `ยังไม่มีรหัส sup ของผู้ขาย "${apCode || '-'}"`);
    }
    if (!weightPerBox) entry.messages.push('สินค้านี้ยังไม่มี กก./กล่อง ในแคตตาล็อก — กรอกเองในตาราง');
    if (unit && !KG_UNITS.includes(unit.toUpperCase())) entry.messages.push(`หน่วยใน PO คือ "${unit}" ไม่ใช่ KG — ตรวจน้ำหนักอีกครั้ง`);
    if (entry.messages.length) entry.status = 'warn';

    lines.push({
      key: startKey + lines.length,
      catalog_product_id: catalog.id,
      customer_product_code: catalog.customer_product_code ?? sku,
      product_code: catalog.internal_product_code ?? catalog.customer_product_code ?? sku,
      product_name: catalog.product_name ?? '',
      temperature_type: catalog.temperature_type ?? 'FROZEN',
      weight_per_box: weightPerBox,
      weight_from_master: Boolean(weightPerBox),
      expected_weight: expectedWeight,
      expected_boxes: expectedBoxes,
      pack_entry_mode: PACK_ENTRY_MODES.WEIGHT,
      entry_unit_code: '',
      entry_unit_qty: '',
      lot_no: lot,
      mfg_date: '',
      exp_date: '',
      line_note: poNo ? `PO ${poNo}` : '',
    });
  });

  const supplierPicksNeeded = [...supplierPicks].map(([apCode, options]) => ({
    apCode,
    options,
    chosen: resolveSupCode(apCode, supplierLotCodes, supplierChoices),
  }));
  return { preview, lines, supplierPicksNeeded };
}

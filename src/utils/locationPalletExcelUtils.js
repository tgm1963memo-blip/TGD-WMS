import { downloadExcelRows } from './excelFileUtils.js';

// Export of the dashboard's "รายละเอียดสินค้าใน Location" modal: one row per
// pallet allocation, plus a "ว่าง" row for each empty slot so the sheet
// mirrors the modal 1:1 (including pallet numbers past the row's capacity).
export const LOCATION_PALLET_EXCEL_HEADERS = [
  'Location',
  'Pallet',
  'รหัสติดตาม',
  'รหัสสินค้าลูกค้า',
  'สินค้า',
  'จำนวน (กล่อง)',
  'น้ำหนัก (กก.)',
  'หมายเหตุ',
];

const COLUMN_WIDTHS = [12, 8, 18, 18, 32, 14, 14, 16];

export function buildLocationPalletExcelRows(locCode = '', slotNumbers = [], pallets = [], capacity = 0) {
  const rows = [];
  for (const palletNo of slotNumbers) {
    const items = pallets.filter((p) => p.palletNo === palletNo);
    const note = palletNo > capacity ? 'เกินความจุ' : '';
    if (items.length === 0) {
      rows.push({ Location: locCode, Pallet: palletNo, 'สินค้า': '— ว่าง —', 'หมายเหตุ': note });
      continue;
    }
    for (const p of items) {
      rows.push({
        Location: locCode,
        Pallet: palletNo,
        'รหัสติดตาม': p.trackingCode ?? '',
        'รหัสสินค้าลูกค้า': p.customerProductCode ?? '',
        'สินค้า': p.productName ?? '',
        'จำนวน (กล่อง)': p.remainingBoxes ?? '',
        'น้ำหนัก (กก.)': p.remainingWeight ?? p.weight ?? '',
        'หมายเหตุ': items.length > 1 ? [note, 'pallet ซ้ำ'].filter(Boolean).join(', ') : note,
      });
    }
  }
  return rows;
}

export function exportLocationPalletExcel(locCode, slotNumbers, pallets, capacity) {
  const safeCode = String(locCode || 'location').replace(/[\\/:*?"<>|]/g, '-');
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');
  downloadExcelRows(
    buildLocationPalletExcelRows(locCode, slotNumbers, pallets, capacity),
    LOCATION_PALLET_EXCEL_HEADERS,
    `location-${safeCode}-${today}.xlsx`,
    String(safeCode).slice(0, 31),
    COLUMN_WIDTHS,
  );
}

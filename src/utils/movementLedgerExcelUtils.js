import { downloadExcelRows } from './excelFileUtils.js';
import { formatDocumentDate } from './documentDisplayUtils.js';
import { isInbound, fmtWt } from '../components/reports/MovementLedgerTable.jsx';

const HEADERS = [
  'วันที่', 'ประเภท', 'ล็อต', 'สินค้า', 'ลูกค้า',
  'รับเข้า (กล่อง)', 'รับเข้า (KG)', 'จ่ายออก (กล่อง)', 'จ่ายออก (KG)', 'อ้างอิง',
];

// Mirrors the columns/values shown in MovementLedgerTable so the exported
// file matches exactly what the user is looking at on screen.
function toExcelRow(row) {
  const inbound = isInbound(row);
  const qty = Number(row.qty ?? row.quantity ?? 0);
  const code = row.product_code ?? row.customer_product_code ?? '';
  const productName = row.product_name ?? row.source_document_no ?? row.product_id ?? '';
  const product = code ? `${code} - ${productName}` : productName;

  return {
    'วันที่': formatDocumentDate(row.movement_date ?? row.created_at, { dateOnly: false }),
    'ประเภท': row.movement_type ?? '',
    'ล็อต': row.lot_no || '-',
    'สินค้า': product,
    'ลูกค้า': row.customer_name ?? row.customer_id ?? '',
    'รับเข้า (กล่อง)': inbound ? qty : '',
    'รับเข้า (KG)': inbound ? fmtWt(row.weight) : '',
    'จ่ายออก (กล่อง)': inbound ? '' : qty,
    'จ่ายออก (KG)': inbound ? '' : fmtWt(row.weight),
    'อ้างอิง': row.source_document_no ?? row.reference_no ?? row.reference_id ?? '',
  };
}

export function downloadMovementLedgerExcel(rows = [], filenamePrefix = 'movement-ledger') {
  const excelRows = rows.map(toExcelRow);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadExcelRows(excelRows, HEADERS, `${filenamePrefix}-${stamp}.xlsx`, 'Movement Ledger');
}

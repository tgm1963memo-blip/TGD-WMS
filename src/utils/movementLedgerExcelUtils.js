import { downloadExcelRows } from './excelFileUtils.js';
import { formatDocumentDate } from './documentDisplayUtils.js';
import { isInbound, fmtWt } from '../components/reports/MovementLedgerTable.jsx';

const HEADERS = [
  'วันที่', 'ประเภท', 'ล็อต', 'สินค้า', 'ลูกค้า',
  'รับเข้า (กล่อง)', 'รับเข้า (KG)', 'จ่ายออก (กล่อง)', 'จ่ายออก (KG)',
  'ยอดคงเหลือ (กล่อง)', 'ยอดคงเหลือ (KG)', 'อ้างอิง',
];

// Group strictly by customer + lot rather than customer + product + lot:
// a physical lot already belongs to exactly one product in this business's
// data model, and lot_no is the one identifier reliably present on every
// row source this report merges — customer withdrawal rows never carry
// product_id at all (see getConfirmedWithdrawalRows), so keying on
// product_id would silently split the same lot's inbound/outbound rows
// into different buckets and produce a wrong running balance. Rows with no
// lot_no at all (rare adjustment-type movements) fall back to grouping by
// whatever product identifier is available so they don't all collapse into
// one bucket.
function balanceKey(row) {
  if (row.lot_no) return `${row.customer_id ?? ''}|lot:${row.lot_no}`;
  const product = row.product_id ?? row.customer_product_code ?? row.product_name ?? '';
  return `${row.customer_id ?? ''}|product:${product}`;
}

// Running balance per customer+product+lot, accumulated in the same
// chronological order the rows are already sorted in (see
// MovementLedgerReportPage), adding inbound and subtracting outbound.
function computeRunningBalances(rows) {
  const balances = new Map();
  return rows.map((row) => {
    const key = balanceKey(row);
    const current = balances.get(key) ?? { qty: 0, weight: 0 };
    const inbound = isInbound(row);
    const qty = Number(row.qty ?? row.quantity ?? 0);
    const weight = Number(row.weight ?? 0);
    const next = {
      qty: current.qty + (inbound ? qty : -qty),
      weight: current.weight + (inbound ? weight : -weight),
    };
    balances.set(key, next);
    return next;
  });
}

// Mirrors the columns/values shown in MovementLedgerTable so the exported
// file matches exactly what the user is looking at on screen, plus a
// running balance column not shown on screen.
function toExcelRow(row, balance) {
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
    'ยอดคงเหลือ (กล่อง)': balance.qty,
    'ยอดคงเหลือ (KG)': Number(balance.weight.toFixed(3)),
    'อ้างอิง': row.source_document_no ?? row.reference_no ?? row.reference_id ?? '',
  };
}

export function downloadMovementLedgerExcel(rows = [], filenamePrefix = 'movement-ledger') {
  const balances = computeRunningBalances(rows);
  const excelRows = rows.map((row, i) => toExcelRow(row, balances[i]));
  const stamp = new Date().toISOString().slice(0, 10);
  downloadExcelRows(excelRows, HEADERS, `${filenamePrefix}-${stamp}.xlsx`, 'Movement Ledger');
}

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
export function movementBalanceKey(row) {
  if (row.lot_no) return `${row.customer_id ?? ''}|lot:${row.lot_no}`;
  const product = row.product_id ?? row.customer_product_code ?? row.product_name ?? '';
  return `${row.customer_id ?? ''}|product:${product}`;
}

function productDisplay(row) {
  const code = row.product_code ?? row.customer_product_code ?? '';
  const name = row.product_name ?? row.source_document_no ?? row.product_id ?? '';
  return code ? `${code} - ${name}` : name;
}

// Regroups rows by product then lot, keeping each group's existing relative
// order intact (rows are expected to already be date-sorted going in, so a
// group's internal order stays chronological). Shared by the on-screen
// table, the PDF report, and the Excel export so all three offer the same
// "sort by date" vs "sort by product/lot" choice consistently.
export function sortRowsByProductThenLot(rows = []) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = movementBalanceKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    const aFirst = groups.get(a)[0];
    const bFirst = groups.get(b)[0];
    const productCompare = productDisplay(aFirst).localeCompare(productDisplay(bFirst), 'th');
    if (productCompare !== 0) return productCompare;
    return String(aFirst.lot_no ?? '').localeCompare(String(bFirst.lot_no ?? ''), 'th');
  });

  return sortedKeys.flatMap((key) => groups.get(key));
}

function zeroBalance() {
  return { qty: 0, weight: 0 };
}

function addMovement(balance, row) {
  const inbound = isInbound(row);
  const qty = Number(row.qty ?? row.quantity ?? 0);
  const weight = Number(row.weight ?? 0);
  return {
    qty: balance.qty + (inbound ? qty : -qty),
    weight: balance.weight + (inbound ? weight : -weight),
  };
}

// Final balance per customer+lot after every row passed in, for use as the
// "brought forward" opening balance of a later period (e.g. all movements
// strictly before the report's Date From).
export function aggregateFinalBalances(rows = []) {
  const balances = new Map();
  rows.forEach((row) => {
    const key = movementBalanceKey(row);
    balances.set(key, addMovement(balances.get(key) ?? zeroBalance(), row));
  });
  return balances;
}

function openingBalanceExcelRow(meta, opening) {
  return {
    'วันที่': '',
    'ประเภท': 'ยกมา',
    'ล็อต': meta.lot_no || '-',
    'สินค้า': productDisplay(meta),
    'ลูกค้า': meta.customer_name ?? meta.customer_id ?? '',
    'รับเข้า (กล่อง)': '',
    'รับเข้า (KG)': '',
    'จ่ายออก (กล่อง)': '',
    'จ่ายออก (KG)': '',
    'ยอดคงเหลือ (กล่อง)': opening.qty,
    'ยอดคงเหลือ (KG)': Number(opening.weight.toFixed(3)),
    'อ้างอิง': '',
  };
}

// Mirrors the columns/values shown in MovementLedgerTable so the exported
// file matches exactly what the user is looking at on screen, plus a
// running balance column not shown on screen.
function movementExcelRow(row, balance) {
  const inbound = isInbound(row);
  const qty = Number(row.qty ?? row.quantity ?? 0);

  return {
    'วันที่': formatDocumentDate(row.movement_date ?? row.created_at, { dateOnly: false }),
    'ประเภท': row.movement_type ?? '',
    'ล็อต': row.lot_no || '-',
    'สินค้า': productDisplay(row),
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

// Builds the export as a stock-card-style ledger: rows grouped by product
// then lot (instead of interleaved by date across every product), each
// group opening with a ยกมา (brought forward) balance carried over from
// openingBalances, so a reader can see each lot's full picture — opening
// stock, every movement, and the resulting balance — in one place.
function buildGroupedExcelRows(rows, openingBalances) {
  const ordered = sortRowsByProductThenLot(rows);

  const excelRows = [];
  let currentKey = null;
  let balance = zeroBalance();

  ordered.forEach((row) => {
    const key = movementBalanceKey(row);
    if (key !== currentKey) {
      currentKey = key;
      balance = openingBalances.get(key) ?? zeroBalance();
      excelRows.push(openingBalanceExcelRow(row, balance));
    }
    balance = addMovement(balance, row);
    excelRows.push(movementExcelRow(row, balance));
  });

  return excelRows;
}

// Flat chronological export (no product/lot grouping or ยกมา rows) — each
// row still carries its own lot's running balance, seeded from
// openingBalances, just displayed in plain date order.
function buildDateOrderedExcelRows(rows, openingBalances) {
  const running = new Map();
  return rows.map((row) => {
    const key = movementBalanceKey(row);
    const balance = addMovement(running.get(key) ?? openingBalances.get(key) ?? zeroBalance(), row);
    running.set(key, balance);
    return movementExcelRow(row, balance);
  });
}

export function buildMovementLedgerExcelRows(rows = [], openingBalances = new Map(), sortMode = 'productLot') {
  return sortMode === 'date'
    ? buildDateOrderedExcelRows(rows, openingBalances)
    : buildGroupedExcelRows(rows, openingBalances);
}

export function downloadMovementLedgerExcel(rows = [], openingBalances = new Map(), sortMode = 'productLot', filenamePrefix = 'movement-ledger') {
  const excelRows = buildMovementLedgerExcelRows(rows, openingBalances, sortMode);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadExcelRows(excelRows, HEADERS, `${filenamePrefix}-${stamp}.xlsx`, 'Movement Ledger');
}

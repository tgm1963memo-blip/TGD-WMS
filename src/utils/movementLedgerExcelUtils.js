import { downloadExcelRows } from './excelFileUtils.js';
import { formatDocumentDate } from './documentDisplayUtils.js';
import { isInbound, fmtWt } from '../components/reports/MovementLedgerTable.jsx';

const HEADERS = [
  'วันที่', 'ประเภท', 'ลูกค้า', 'รหัสติดตาม', 'สินค้า', 'ประเภทสินค้า', 'lot', 'วันผลิต',
  'อุณหภูมิ', 'Location',
  'รับเข้า(กล่อง)', 'รับเข้า(น้ำหนัก)', 'จ่ายออก(กล่อง)', 'จ่ายออก(น้ำหนัก)',
  'คงเหลือ(กล่อง)', 'คงเหลือ(น้ำหนัก)'
];

// Column widths (character units, matching XLSX's !cols wch convention) so
// the exported sheet reads well without manual resizing — sized to the
// widest realistic content per column (Thai product names/customer names
// need more room than short codes/dates).
const COLUMN_WIDTHS = [
  16, // วันที่ (dd/mm/yyyy, HH:mm)
  14, // ประเภท
  28, // ลูกค้า
  14, // รหัสติดตาม
  42, // สินค้า (code - name, often long in Thai)
  16, // ประเภทสินค้า
  10, // lot
  12, // วันผลิต
  10, // อุณหภูมิ
  18, // Location
  13, // รับเข้า(กล่อง)
  15, // รับเข้า(น้ำหนัก)
  13, // จ่ายออก(กล่อง)
  15, // จ่ายออก(น้ำหนัก)
  13, // คงเหลือ(กล่อง)
  15, // คงเหลือ(น้ำหนัก)
];

// Product identity for grouping — deliberately NOT product_id, since deposit,
// withdrawal, and stock_movement rows resolve product_id through different,
// not-always-populated paths (see getConfirmedWithdrawalRows). customer_
// product_code/product_name are the fields productDisplay() already renders
// successfully for every row source, so they're the reliable identifier here.
function productIdentity(row) {
  return row.product_code ?? row.customer_product_code ?? row.product_name ?? row.product_id ?? '';
}

// Grouped by customer + PRODUCT + lot (or, when groupBy is 'trackingCode',
// + tracking code instead), not customer + lot alone: a LOT number in this
// business's real data is NOT always unique per product (the same lot
// number has been observed reused across unrelated products), so grouping
// by lot only collapsed different products' rows into one bucket — their
// running balances got summed together, and sorting "by product" only ever
// looked at the bucket's first row, silently scattering a product's own
// rows across whatever lot-buckets its rows happened to land in. Rows with
// no lot_no/tracking_code at all (rare adjustment-type movements) fall back
// to grouping by product alone so they don't scatter across a fake per-row
// bucket.
//
// The trackingCode mode exists because a single LOT can itself span several
// tracking codes (several receiving batches under one lot label) — grouping
// by lot alone merges those distinct physical batches' balances together,
// which is exactly right for a lot-level stock card but hides which
// specific batch is running low/out. Grouping by tracking code instead
// shows each physical batch's own balance.
export function movementBalanceKey(row, groupBy = 'lot') {
  const product = productIdentity(row);
  if (groupBy === 'trackingCode') {
    if (row.tracking_code) return `${row.customer_id ?? ''}|${product}|trk:${row.tracking_code}`;
    return `${row.customer_id ?? ''}|product:${product}`;
  }
  if (row.lot_no) return `${row.customer_id ?? ''}|${product}|lot:${row.lot_no}`;
  return `${row.customer_id ?? ''}|product:${product}`;
}

function productDisplay(row) {
  const code = row.product_code ?? row.customer_product_code ?? '';
  const name = row.product_name ?? row.source_document_no ?? row.product_id ?? '';
  return code ? `${code} - ${name}` : name;
}

// Regroups rows by product then lot (or product then tracking code, when
// groupBy is 'trackingCode'), keeping each group's existing relative order
// intact (rows are expected to already be date-sorted going in, so a
// group's internal order stays chronological). Shared by the on-screen
// table, the PDF report, and the Excel export so all three offer the same
// "sort by date" vs "sort by product/lot" vs "sort by product/tracking
// code" choice consistently.
export function sortRowsByProductThenLot(rows = [], groupBy = 'lot') {
  const groups = new Map();
  rows.forEach((row) => {
    const key = movementBalanceKey(row, groupBy);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const secondaryField = groupBy === 'trackingCode' ? 'tracking_code' : 'lot_no';
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    const aFirst = groups.get(a)[0];
    const bFirst = groups.get(b)[0];
    const productCompare = productDisplay(aFirst).localeCompare(productDisplay(bFirst), 'th');
    if (productCompare !== 0) return productCompare;
    return String(aFirst[secondaryField] ?? '').localeCompare(String(bFirst[secondaryField] ?? ''), 'th');
  });

  return sortedKeys.flatMap((key) => groups.get(key));
}

function zeroBalance() {
  return { qty: 0, weight: 0 };
}

// Exported so every place that tracks a running lot/tracking-code balance
// (this file's own Excel export, and the on-screen admin ledger table)
// shares one definition instead of drifting apart.
export function addMovement(balance, row) {
  const inbound = isInbound(row);
  const qty = Number(row.qty ?? row.quantity ?? 0);
  const weight = Number(row.weight ?? 0);
  const nextQty = balance.qty + (inbound ? qty : -qty);
  const nextWeight = balance.weight + (inbound ? weight : -weight);
  // Once box balance hits (or drops below) zero, the lot is fully
  // depleted — any leftover weight is measurement/rounding drift across
  // separate deposit/withdrawal weighings (each box counted individually,
  // but weight comes from independent scale readings), not real physical
  // stock. Reported a real case: 32 boxes deposited and 32 withdrawn (box
  // balance exactly 0) but the deposit's recorded weight and the
  // withdrawal's recorded weight differed by a few kg, leaving a phantom
  // "0.01"/"1.00"/"18.69" kg balance forever with 0 boxes to hold it.
  // Mirrors tgd_get_customer_stock_balance's own WHERE GREATEST(0,
  // received_boxes - withdrawn_boxes) > 0 guard, which drops a
  // box-depleted line's weight entirely rather than reporting whatever
  // arithmetic happens to leave behind.
  if (nextQty <= 0) return zeroBalance();
  return { qty: nextQty, weight: Math.max(0, nextWeight) };
}

// Final balance per customer+lot after every row passed in, for use as the
// "brought forward" opening balance of a later period (e.g. all movements
// strictly before the report's Date From).
export function aggregateFinalBalances(rows = [], groupBy = 'lot') {
  const balances = new Map();
  rows.forEach((row) => {
    const key = movementBalanceKey(row, groupBy);
    balances.set(key, addMovement(balances.get(key) ?? zeroBalance(), row));
  });
  return balances;
}

function openingBalanceExcelRow(meta, opening) {
  return {
    'วันที่': '',
    'ประเภท': 'ยกมา',
    'ลูกค้า': meta.customer_name || '-',
    'รหัสติดตาม': meta.tracking_code || '-',
    'สินค้า': productDisplay(meta),
    'ประเภทสินค้า': meta.product_category || '-',
    'lot': meta.lot_no || '-',
    'วันผลิต': meta.mfg_date ? formatDocumentDate(meta.mfg_date, { dateOnly: true }) : '-',
    'อุณหภูมิ': meta.temperature_type || '-',
    'Location': meta.location_name || '-',
    'รับเข้า(กล่อง)': '',
    'รับเข้า(น้ำหนัก)': '',
    'จ่ายออก(กล่อง)': '',
    'จ่ายออก(น้ำหนัก)': '',
    'คงเหลือ(กล่อง)': opening.qty,
    'คงเหลือ(น้ำหนัก)': Number(opening.weight.toFixed(3)),
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
    'ลูกค้า': row.customer_name || '-',
    'รหัสติดตาม': row.tracking_code || '-',
    'สินค้า': productDisplay(row),
    'ประเภทสินค้า': row.product_category || '-',
    'lot': row.lot_no || '-',
    'วันผลิต': row.mfg_date ? formatDocumentDate(row.mfg_date, { dateOnly: true }) : '-',
    'อุณหภูมิ': row.temperature_type || '-',
    'Location': row.location_name || '-',
    'รับเข้า(กล่อง)': inbound ? qty : '',
    'รับเข้า(น้ำหนัก)': inbound ? fmtWt(row.weight) : '',
    'จ่ายออก(กล่อง)': inbound ? '' : qty,
    'จ่ายออก(น้ำหนัก)': inbound ? '' : fmtWt(row.weight),
    'คงเหลือ(กล่อง)': balance.qty,
    'คงเหลือ(น้ำหนัก)': Number(balance.weight.toFixed(3)),
  };
}

// Builds the export as a stock-card-style ledger: rows grouped by product
// then lot (instead of interleaved by date across every product), each
// group opening with a ยกมา (brought forward) balance carried over from
// openingBalances, so a reader can see each lot's full picture — opening
// stock, every movement, and the resulting balance — in one place.
function buildGroupedExcelRows(rows, openingBalances, groupBy = 'lot') {
  const ordered = sortRowsByProductThenLot(rows, groupBy);

  const excelRows = [];
  let currentKey = null;
  let balance = zeroBalance();

  ordered.forEach((row) => {
    const key = movementBalanceKey(row, groupBy);
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
function buildDateOrderedExcelRows(rows, openingBalances, groupBy = 'lot') {
  const running = new Map();
  return rows.map((row) => {
    const key = movementBalanceKey(row, groupBy);
    const balance = addMovement(running.get(key) ?? openingBalances.get(key) ?? zeroBalance(), row);
    running.set(key, balance);
    return movementExcelRow(row, balance);
  });
}

function totalsExcelRow(totals) {
  return {
    'วันที่': '',
    'ประเภท': 'รวมทั้งหมด',
    'ลูกค้า': '',
    'รหัสติดตาม': '',
    'สินค้า': '',
    'ประเภทสินค้า': '',
    'lot': '',
    'วันผลิต': '',
    'อุณหภูมิ': '',
    'Location': '',
    'รับเข้า(กล่อง)': totals.receivedQty,
    'รับเข้า(น้ำหนัก)': Number(totals.receivedWeight.toFixed(3)),
    'จ่ายออก(กล่อง)': totals.deliveredQty,
    'จ่ายออก(น้ำหนัก)': Number(totals.deliveredWeight.toFixed(3)),
    'คงเหลือ(กล่อง)': totals.balanceQty,
    'คงเหลือ(น้ำหนัก)': Number(totals.balanceWeight.toFixed(3)),
  };
}

// Grand totals across every row: received/delivered are plain sums, but the
// remaining balance is summed once per distinct lot (its final balance —
// opening plus this period's net movement), not once per row, since a lot's
// balance appears on every one of its rows as a running total.
function computeGrandTotals(rows, openingBalances, authoritativeTotals = null, groupBy = 'lot') {
  let receivedQty = 0;
  let receivedWeight = 0;
  let deliveredQty = 0;
  let deliveredWeight = 0;
  rows.forEach((row) => {
    const qty = Number(row.qty ?? row.quantity ?? 0);
    const weight = Number(row.weight ?? 0);
    if (isInbound(row)) {
      receivedQty += qty;
      receivedWeight += weight;
    } else {
      deliveredQty += qty;
      deliveredWeight += weight;
    }
  });

  // Final balance per lot must be replayed chronologically from its own
  // opening balance, flooring at 0 at every step (addMovement does this) —
  // NOT "opening + net movement computed independently of opening", which
  // ignores the floor entirely and understates the total whenever a lot's
  // recorded withdrawals exceed what it received (same clamp-at-0 rule the
  // stock balance page's RPC applies).
  const dateSorted = [...rows].sort((a, b) =>
    new Date(a.movement_date ?? a.created_at ?? 0).getTime() - new Date(b.movement_date ?? b.created_at ?? 0).getTime());

  const finalBalanceByKey = new Map();
  dateSorted.forEach((row) => {
    const key = movementBalanceKey(row, groupBy);
    const seed = finalBalanceByKey.get(key) ?? openingBalances.get(key) ?? zeroBalance();
    finalBalanceByKey.set(key, addMovement(seed, row));
  });

  let balanceQty = 0;
  let balanceWeight = 0;
  finalBalanceByKey.forEach((balance) => {
    balanceQty += balance.qty;
    balanceWeight += balance.weight;
  });
  // A lot with an opening balance but no movement rows in this period still
  // carries its (already-floored) balance forward into the grand total.
  openingBalances.forEach((opening, key) => {
    if (!finalBalanceByKey.has(key)) {
      balanceQty += opening.qty;
      balanceWeight += opening.weight;
    }
  });

  // authoritativeTotals (same source as the stock balance page's RPC —
  // see getAuthoritativeBalanceTotals) overrides the locally-replayed sum
  // when supplied, so the exported grand total matches that page exactly.
  //
  // received/delivered get overridden too, not just the balance — they must
  // come from the same all-time, floor-aware computation the balance did,
  // or receivedQty - deliveredQty (this period's raw sums only) won't equal
  // balanceQty (all-time). Defining delivered as received - balance
  // guarantees the three figures reconcile exactly.
  if (authoritativeTotals) {
    receivedQty = authoritativeTotals.totalReceivedBoxes ?? receivedQty;
    receivedWeight = authoritativeTotals.totalReceivedWeight ?? receivedWeight;
    balanceQty = authoritativeTotals.totalBoxes;
    balanceWeight = authoritativeTotals.totalWeight;
    deliveredQty = authoritativeTotals.totalDeliveredBoxes ?? (receivedQty - balanceQty);
    deliveredWeight = authoritativeTotals.totalDeliveredWeight ?? (receivedWeight - balanceWeight);
  }

  return { receivedQty, receivedWeight, deliveredQty, deliveredWeight, balanceQty, balanceWeight };
}

export function buildMovementLedgerExcelRows(rows = [], openingBalances = new Map(), sortMode = 'productLot', authoritativeTotals = null) {
  const groupBy = sortMode === 'productTrackingCode' ? 'trackingCode' : 'lot';
  const excelRows = sortMode === 'date'
    ? buildDateOrderedExcelRows(rows, openingBalances, groupBy)
    : buildGroupedExcelRows(rows, openingBalances, groupBy);

  if (rows.length > 0) {
    excelRows.push(totalsExcelRow(computeGrandTotals(rows, openingBalances, authoritativeTotals, groupBy)));
  }

  return excelRows;
}

export function downloadMovementLedgerExcel(rows = [], openingBalances = new Map(), sortMode = 'productLot', filenamePrefix = 'movement-ledger', authoritativeTotals = null) {
  const excelRows = buildMovementLedgerExcelRows(rows, openingBalances, sortMode, authoritativeTotals);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadExcelRows(excelRows, HEADERS, `${filenamePrefix}-${stamp}.xlsx`, 'Movement Ledger', COLUMN_WIDTHS);
}

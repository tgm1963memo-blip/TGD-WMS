// Gathers everything the customer-format Excel billing statement prints
// (billingStatementModel.js / billingStatementExcel.js): the rate engine's
// period preview -- the same call the invoice draft itself is built from, so
// the statement can never disagree with it about what was billable -- plus
// the two raw attachments the hand-made files carry (Movement Ledger of the
// period, Stock Report at the cut-off).
import { supabase } from './supabaseClient.js';
import { getBillingPeriodPreview } from './billingRateEngineService.js';
import { fetchMergedMovementLedgerRows } from './movementLedgerMergedRows.js';
import { getCustomerStockBalance } from './customerDepositRequestService.js';
import { getCustomers, getProducts } from './masterDataService.js';
import { getActiveLocations } from './warehouseLayoutService.js';
import {
  aggregateFinalBalances, buildMovementLedgerExcelRows,
  MOVEMENT_LEDGER_EXCEL_HEADERS, MOVEMENT_LEDGER_EXCEL_COLUMN_WIDTHS,
} from '../utils/movementLedgerExcelUtils.js';
import { addDays, formatMonthTag } from '../utils/billingStatementModel.js';

const STOCK_REPORT_HEADERS = [
  'ลูกค้า', 'รหัสสินค้า', 'ชื่อสินค้า', 'อุณหภูมิ', 'เลขที่ใบฝาก', 'วันที่รับเข้า', 'LOT', 'รหัสติดตาม', 'คงเหลือ (กล่อง)', 'คงเหลือ (กก.)',
];
const STOCK_REPORT_WIDTHS = [30, 16, 40, 14, 22, 14, 18, 16, 16, 16];

// Movement Ledger of the billing period, grouped by tracking code with each
// one's ยกมา opening balance -- the same rows and the same Excel row builder
// the Movement Ledger report page exports.
async function buildLedgerAttachment({ customerId, customerName, periodStart, periodEnd, keepRow }) {
  const filters = { customerId };
  const [main, prior, productResult, locationResult] = await Promise.all([
    fetchMergedMovementLedgerRows({ ...filters, dateFrom: periodStart, dateTo: periodEnd }, {}),
    fetchMergedMovementLedgerRows({ ...filters, dateTo: addDays(periodStart, -1) }, {}),
    getProducts({ isActive: true }),
    getActiveLocations(),
  ]);
  if (main.error) return { error: main.error };
  if (prior.error) return { error: prior.error };

  const productName = new Map((productResult.data ?? []).map((p) => [p.id, p.sku ? `${p.sku} — ${p.name}` : (p.name ?? p.id)]));
  const productTemp = new Map((productResult.data ?? []).map((p) => [p.id, p.temperature_type]));
  const locationName = new Map((locationResult.data ?? []).map((l) => [l.id, l.label ?? l.code ?? l.id]));
  const enrich = (rows) => rows.map((row) => ({
    ...row,
    product_name: row.product_name ?? productName.get(row.product_id) ?? row.product_id,
    customer_name: row.customer_name ?? customerName,
    temperature_type: row.temperature_type ?? productTemp.get(row.product_id) ?? null,
    location_name: row.location_name ?? (row.location_id ? (locationName.get(row.location_id) ?? row.location_id) : null),
  })).filter(keepRow);

  const rows = enrich(main.rows);
  const openingBalances = aggregateFinalBalances(enrich(prior.rows), 'trackingCode');
  const excelRows = buildMovementLedgerExcelRows(rows, openingBalances, 'productTrackingCode');
  return {
    data: {
      sheetName: `Movement Ledger ${formatMonthTag(periodEnd)}`,
      headers: MOVEMENT_LEDGER_EXCEL_HEADERS,
      widths: MOVEMENT_LEDGER_EXCEL_COLUMN_WIDTHS,
      rows: excelRows.map((row) => MOVEMENT_LEDGER_EXCEL_HEADERS.map((h) => row[h] ?? '')),
    },
  };
}

async function buildStockAttachment({ customerId, customerName, periodEnd, keepRow }) {
  const result = await getCustomerStockBalance(customerId, periodEnd);
  if (result.error) return { error: result.error };
  const [, m, d] = periodEnd.split('-');
  const rows = (result.data ?? []).filter(keepRow).map((r) => [
    customerName,
    r.customer_product_code ?? '',
    r.product_name ?? '',
    r.temperature_type ?? '',
    r.request_no ?? '',
    r.received_at ? String(r.received_at).split('T')[0] : '',
    r.lot_no ?? '',
    r.tracking_code ?? '',
    Number(r.balance_boxes ?? 0),
    Number(r.balance_weight ?? 0),
  ]);
  return { data: { sheetName: `Stock Report ${d}.${m}`, headers: STOCK_REPORT_HEADERS, widths: STOCK_REPORT_WIDTHS, rows } };
}

export async function getBillingStatementExportData({
  customerId, periodStart, periodEnd, temperatureType = null, productCategory = null, includeAttachments = true,
}) {
  if (!supabase) return { data: null, error: new Error('Supabase client not configured.') };

  const [previewResult, customersResult] = await Promise.all([
    getBillingPeriodPreview({ customerId, periodStart, periodEnd, temperatureType, productCategory }),
    getCustomers({}),
  ]);
  if (previewResult.error) return { data: null, error: previewResult.error };
  const customer = (customersResult.data ?? []).find((c) => c.id === customerId) ?? { id: customerId };
  const preview = previewResult.data;

  const attachments = [];
  const attachmentWarnings = [];
  if (includeAttachments) {
    // The bill's own scope (storage method / product group) decides which
    // lots the attachments show: preview.depositLines is already scoped the
    // way the bill is, so membership in it is the test -- by deposit line
    // for the stock report, by tracking code for ledger rows.
    const scoped = Boolean(temperatureType || productCategory);
    const lineIds = new Set(preview.depositLines.map((dl) => dl.id));
    const trackingCodes = new Set(preview.depositLines.map((dl) => dl.tracking_code).filter(Boolean));
    const customerName = customer.customer_name ?? '';
    const [ledger, stock] = await Promise.all([
      buildLedgerAttachment({
        customerId, customerName, periodStart, periodEnd,
        keepRow: (row) => !scoped || (row.tracking_code ? trackingCodes.has(row.tracking_code) : false),
      }),
      buildStockAttachment({
        customerId, customerName, periodEnd,
        keepRow: (row) => !scoped || lineIds.has(row.deposit_line_id),
      }),
    ]);
    // An attachment that fails to load must not block the statement itself --
    // the caller is told which sheet is missing and why.
    if (ledger.error) attachmentWarnings.push(`Movement Ledger: ${ledger.error.message ?? ledger.error}`);
    else attachments.push(ledger.data);
    if (stock.error) attachmentWarnings.push(`Stock Report: ${stock.error.message ?? stock.error}`);
    else attachments.push(stock.data);
  }

  return { data: { preview, customer, attachments, attachmentWarnings }, error: null };
}

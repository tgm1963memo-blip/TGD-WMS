import { supabase } from './supabaseClient.js';
import { listAllProductServiceRates } from './productServiceRatesService.js';
import { listCustomerProducts } from './customerProductCatalogService.js';
import { computeStorageInvoiceLines, computeAuxiliaryServiceLines } from '../utils/billingRateCalc.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

// Deposit lines rarely carry a resolvable master product_id (see
// getConfirmedWithdrawalRows/getConfirmedDepositReceiptRows comments
// elsewhere in this codebase), but a product-specific service rate is
// keyed on tgd_customer_products.id (the catalog row), which we CAN
// resolve reliably via customer_product_code — same approach used
// throughout the withdrawal/deposit line matching code in this app.
function buildCustomerProductIdMap(catalogRows = []) {
  const map = new Map();
  for (const row of catalogRows) {
    if (row.customer_product_code) map.set(row.customer_product_code, row.id);
  }
  return map;
}

// Finds, for each deposit line, the date it became fully depleted (if it
// did) using only exactly-matched withdrawal lines (direct source link or
// tracking code) — a withdrawal line pooled ambiguously across sibling
// deposit lines (see stockBalanceCalc.js) has no clean per-line date
// attribution, so those lines are conservatively left "still in storage"
// (biases toward billing more, not less, rather than guessing a date).
function computeExitDates(depositLines, withdrawalLines) {
  const depositById = new Map(depositLines.map((dl) => [dl.id, dl]));
  const depositByTrackingCode = new Map();
  for (const dl of depositLines) {
    if (dl.tracking_code) depositByTrackingCode.set(dl.tracking_code, dl);
  }

  const matchedByLine = new Map(); // deposit_line_id -> [{ weight, date }]
  for (const wl of withdrawalLines) {
    let matchedId = null;
    if (wl.source_customer_deposit_request_line_id && depositById.has(wl.source_customer_deposit_request_line_id)) {
      matchedId = wl.source_customer_deposit_request_line_id;
    } else if (!wl.source_customer_deposit_request_line_id && wl.tracking_code && depositByTrackingCode.has(wl.tracking_code)) {
      matchedId = depositByTrackingCode.get(wl.tracking_code).id;
    }
    if (matchedId == null) continue;
    const bucket = matchedByLine.get(matchedId) ?? [];
    bucket.push({ weight: Number(wl.picked_weight ?? 0), date: wl.picked_at ?? wl.requested_dispatch_date ?? null });
    matchedByLine.set(matchedId, bucket);
  }

  const exitDates = new Map();
  for (const dl of depositLines) {
    const matches = matchedByLine.get(dl.id) ?? [];
    const totalExact = matches.reduce((sum, m) => sum + m.weight, 0);
    const receivedWeight = Number(dl.actual_weight ?? dl.expected_weight ?? 0);
    if (totalExact >= receivedWeight - 0.001 && matches.length > 0) {
      const lastDate = matches
        .map((m) => (m.date ? String(m.date).split('T')[0] : null))
        .filter(Boolean)
        .sort()
        .pop();
      exitDates.set(dl.id, lastDate ?? null);
    }
  }
  return exitDates;
}

// Computes the storage + auxiliary-service invoice lines a customer would
// be billed for a given period, using the exact same rate configuration
// admins set up on the Product Service Rates page. Read-only preview —
// callers decide whether/how to persist these as actual invoice draft lines.
export async function getBillingPeriodPreview({ customerId, periodStart, periodEnd }) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId || !periodStart || !periodEnd) {
    return { data: null, error: new Error('customerId, periodStart, and periodEnd are required.') };
  }

  const [depositResult, withdrawalResult, ratesResult, catalogResult] = await Promise.all([
    supabase
      .from('tgd_customer_deposit_requests')
      .select(`
        id, customer_id, expected_arrival_date, last_action_at,
        tgd_customer_deposit_request_lines(
          id, customer_product_code, temperature_type, tracking_code,
          actual_boxes, actual_weight, expected_boxes, expected_weight
        )
      `)
      .eq('customer_id', customerId)
      .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED']),
    supabase
      .from('tgd_customer_withdrawal_requests')
      .select(`
        customer_id,
        tgd_customer_withdrawal_request_lines(
          source_customer_deposit_request_line_id, tracking_code, customer_product_code,
          picked_boxes, picked_weight, picked_at
        )
      `)
      .eq('customer_id', customerId)
      .eq('status', 'COMPLETED'),
    listAllProductServiceRates({ customerId, isActive: true }),
    listCustomerProducts({ customerId }),
  ]);

  if (depositResult.error) return { data: null, error: depositResult.error };
  if (withdrawalResult.error) return { data: null, error: withdrawalResult.error };
  if (ratesResult.error) return { data: null, error: ratesResult.error };
  if (catalogResult.error) return { data: null, error: catalogResult.error };

  const codeToProductId = buildCustomerProductIdMap(catalogResult.data ?? []);

  const rawDepositLines = [];
  const depositRequestIds = [];
  for (const req of (depositResult.data ?? [])) {
    depositRequestIds.push(req.id);
    const receiptDate = req.expected_arrival_date ?? (req.last_action_at ? String(req.last_action_at).split('T')[0] : null);
    for (const line of (req.tgd_customer_deposit_request_lines ?? [])) {
      rawDepositLines.push({
        ...line,
        customer_id: req.customer_id,
        receipt_date: receiptDate,
      });
    }
  }

  const rawWithdrawalLines = [];
  for (const req of (withdrawalResult.data ?? [])) {
    for (const line of (req.tgd_customer_withdrawal_request_lines ?? [])) {
      rawWithdrawalLines.push({ ...line, customer_id: req.customer_id });
    }
  }

  const exitDates = computeExitDates(rawDepositLines, rawWithdrawalLines);

  const depositLines = rawDepositLines.map((line) => ({
    id: line.id,
    customer_id: line.customer_id,
    customer_product_id: codeToProductId.get(line.customer_product_code) ?? null,
    temperature_type: line.temperature_type ?? null,
    received_weight: Number(line.actual_weight ?? line.expected_weight ?? 0),
    receipt_date: line.receipt_date,
    exit_date: exitDates.get(line.id) ?? null,
    customer_product_code: line.customer_product_code ?? null,
  }));

  const storageLines = computeStorageInvoiceLines({
    depositLines,
    rates: ratesResult.data ?? [],
    periodStart,
    periodEnd,
  });

  let auxLines = [];
  if (depositRequestIds.length > 0) {
    const auxResult = await supabase
      .from('tgd_customer_deposit_request_services')
      .select('id, deposit_request_id, service_rate_id, quantity, note')
      .in('deposit_request_id', depositRequestIds);
    if (auxResult.error) return { data: null, error: auxResult.error };

    const rateById = new Map((ratesResult.data ?? []).map((r) => [r.id, r]));
    const requestReceiptDate = new Map(
      (depositResult.data ?? []).map((req) => [
        req.id,
        req.expected_arrival_date ?? (req.last_action_at ? String(req.last_action_at).split('T')[0] : null),
      ]),
    );

    const selections = (auxResult.data ?? [])
      .filter((row) => {
        const date = requestReceiptDate.get(row.deposit_request_id);
        return date && date >= periodStart && date <= periodEnd;
      })
      .map((row) => ({
        depositRequestId: row.deposit_request_id,
        customerId,
        rate: rateById.get(row.service_rate_id),
        quantity: row.quantity,
        note: row.note,
        selectionId: row.id,
      }))
      .filter((sel) => sel.rate);

    auxLines = computeAuxiliaryServiceLines({ selections });
  }

  return { data: { storageLines, auxLines, depositLines }, error: null };
}

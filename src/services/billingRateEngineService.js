import { supabase } from './supabaseClient.js';
import { listAllProductServiceRates } from './productServiceRatesService.js';
import { listCustomerProducts } from './customerProductCatalogService.js';
import {
  computeStorageInvoiceLines, computeAuxiliaryServiceLines, generateLotBillingCycles, resolveServiceRate,
  computeHandlingFeeLines, resolveStorageRateForLine,
} from '../utils/billingRateCalc.js';
import { INVOICE_DRAFT_LINE_TABLE, INVOICE_DRAFT_STATUS } from '../utils/billingInvoiceDraftUtils.js';

const NON_CANCELLED_INVOICE_DRAFT_STATUSES = Object.values(INVOICE_DRAFT_STATUS)
  .filter((status) => status !== INVOICE_DRAFT_STATUS.CANCELLED);

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

// Classifies WHY a deposit line has no usable STORAGE rate as of asOfDate,
// for the "unratedDepositLines"/"unratedLots" visibility list — distinct
// from resolveServiceRate's own contract-window filtering (see
// billingRateCalc.js), which just returns null either way. Resolving once
// WITHOUT asOfDate first tells us whether a candidate rate exists at all
// (ignoring its contract window) so we can tell "no rate configured" apart
// from "a rate exists but this date falls outside its contract window" —
// the latter needs the customer told which side of the window it's on
// (not started yet vs. already expired) instead of just "missing."
function classifyUnratedReason(rates, dl, asOfDate) {
  // resolveStorageRateForLine (not the bare resolveServiceRate) so a lot
  // that resolves only via the FREEZE_FROZEN->FROZEN fallback is correctly
  // read as "has a candidate rate" here too, not double-counted as missing.
  const dateUnfilteredCandidate = resolveStorageRateForLine(rates, dl, null);
  if (!dateUnfilteredCandidate) return 'NO_RATE_CONFIGURED';
  if (!asOfDate) return 'NO_RATE_CONFIGURED';
  if (dateUnfilteredCandidate.contract_start_date && asOfDate < dateUnfilteredCandidate.contract_start_date) {
    return 'CONTRACT_NOT_STARTED';
  }
  if (dateUnfilteredCandidate.contract_end_date && asOfDate > dateUnfilteredCandidate.contract_end_date) {
    return 'CONTRACT_EXPIRED';
  }
  return 'NO_RATE_CONFIGURED';
}

export function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Deposit lines rarely carry a resolvable master product_id (see
// getConfirmedWithdrawalRows/getConfirmedDepositReceiptRows comments
// elsewhere in this codebase), but a product-specific service rate is
// keyed on tgd_customer_products.id (the catalog row), which we CAN
// resolve reliably via customer_product_code — same approach used
// throughout the withdrawal/deposit line matching code in this app.
//
// Also maps each code to the master catalog's CURRENT temperature_type —
// deposit lines snapshot temperature_type at deposit time (copied from the
// catalog then, see CustomerDepositLinesTable.jsx's selectCatalogProduct),
// which can drift from the master if the catalog entry is corrected later
// or the line predates a catalog fix. A storage rate scoped to a
// temperature tier must key off the master's classification, not a
// possibly-stale per-line snapshot, so an item master correction is
// reflected in billing immediately.
export function buildCatalogMaps(catalogRows = []) {
  const productIdByCode = new Map();
  const temperatureTypeByCode = new Map();
  for (const row of catalogRows) {
    if (!row.customer_product_code) continue;
    productIdByCode.set(row.customer_product_code, row.id);
    if (row.temperature_type) temperatureTypeByCode.set(row.customer_product_code, row.temperature_type);
  }
  return { productIdByCode, temperatureTypeByCode };
}

// Groups, per deposit line, the withdrawal events (weight + date) that
// reduce how much of it is still in storage — using only exactly-matched
// withdrawal lines (direct source link or tracking code). A withdrawal line
// pooled ambiguously across sibling deposit lines (see stockBalanceCalc.js)
// has no clean per-line attribution, so it's left out entirely rather than
// guessed at — the deposit line keeps billing its full weight for those
// withdrawals (biases toward billing more, not less).
//
// computeStorageInvoiceLines uses this to prorate the chargeable weight
// down from the date of each partial withdrawal onward, instead of only
// zeroing out a line once it's 100% withdrawn.
function buildWithdrawalEventsByLine(depositLines, withdrawalLines) {
  const depositById = new Map(depositLines.map((dl) => [dl.id, dl]));
  const depositByTrackingCode = new Map();
  for (const dl of depositLines) {
    if (dl.tracking_code) depositByTrackingCode.set(dl.tracking_code, dl);
  }

  const eventsByLine = new Map(); // deposit_line_id -> [{ weight, date }]
  for (const wl of withdrawalLines) {
    let matchedId = null;
    if (wl.source_customer_deposit_request_line_id && depositById.has(wl.source_customer_deposit_request_line_id)) {
      matchedId = wl.source_customer_deposit_request_line_id;
    } else if (!wl.source_customer_deposit_request_line_id && wl.tracking_code && depositByTrackingCode.has(wl.tracking_code)) {
      matchedId = depositByTrackingCode.get(wl.tracking_code).id;
    }
    if (matchedId == null) continue;
    const bucket = eventsByLine.get(matchedId) ?? [];
    const date = wl.picked_at ?? wl.requested_dispatch_date ?? null;
    bucket.push({ weight: Number(wl.picked_weight ?? 0), date: date ? String(date).split('T')[0] : null });
    eventsByLine.set(matchedId, bucket);
  }
  return eventsByLine;
}

// Shared fetch for both the manual (customer-wide date range) and auto
// (per-lot cycle) billing preview paths — deposit lines + their matched
// withdrawal events + resolved rates + catalog, all scoped to one customer.
// Neither caller filters by date at the query level; computeStorageInvoiceLines
// (or, for auto mode, a per-cycle call to it) does that per lot.
async function fetchRateEngineInputs({ customerId }) {
  const [depositResult, withdrawalResult, ratesResult, catalogResult] = await Promise.all([
    supabase
      .from('tgd_customer_deposit_requests')
      .select(`
        id, customer_id, expected_arrival_date, last_action_at, requires_r3_document,
        tgd_customer_deposit_request_lines(
          id, customer_product_code, temperature_type, tracking_code, lot_no,
          actual_boxes, actual_weight, expected_boxes, expected_weight
        )
      `)
      .eq('customer_id', customerId)
      .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED']),
    supabase
      .from('tgd_customer_withdrawal_requests')
      .select(`
        id, customer_id, requested_dispatch_date, requires_r3_document,
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

  if (depositResult.error) return { error: depositResult.error };
  if (withdrawalResult.error) return { error: withdrawalResult.error };
  if (ratesResult.error) return { error: ratesResult.error };
  if (catalogResult.error) return { error: catalogResult.error };

  const { productIdByCode, temperatureTypeByCode } = buildCatalogMaps(catalogResult.data ?? []);

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
  const withdrawalRequestIds = [];
  for (const req of (withdrawalResult.data ?? [])) {
    withdrawalRequestIds.push(req.id);
    for (const line of (req.tgd_customer_withdrawal_request_lines ?? [])) {
      rawWithdrawalLines.push({ ...line, customer_id: req.customer_id });
    }
  }

  const withdrawalEventsByLine = buildWithdrawalEventsByLine(rawDepositLines, rawWithdrawalLines);

  const depositLines = rawDepositLines.map((line) => ({
    id: line.id,
    customer_id: line.customer_id,
    customer_product_id: productIdByCode.get(line.customer_product_code) ?? null,
    // Master catalog's current classification wins; the line's own
    // snapshot only covers products no longer present in the catalog.
    temperature_type: temperatureTypeByCode.get(line.customer_product_code) ?? line.temperature_type ?? null,
    received_weight: Number(line.actual_weight ?? line.expected_weight ?? 0),
    receipt_date: line.receipt_date,
    withdrawal_events: withdrawalEventsByLine.get(line.id) ?? [],
    customer_product_code: line.customer_product_code ?? null,
    lot_no: line.lot_no ?? null,
  }));

  const requestReceiptDateById = new Map(
    (depositResult.data ?? []).map((req) => [
      req.id,
      req.expected_arrival_date ?? (req.last_action_at ? String(req.last_action_at).split('T')[0] : null),
    ]),
  );

  const requestDispatchDateById = new Map(
    (withdrawalResult.data ?? []).map((req) => [req.id, req.requested_dispatch_date ?? null]),
  );

  // Deposit/withdrawal requests flagged as needing ร.3 processing — each
  // bills a flat, one-time fee once the underlying document is confirmed
  // (deposit: RECEIVED_CONFIRMED/CUSTOMER_NOTIFIED, matching the status
  // filter already used for storage lines above; withdrawal: COMPLETED,
  // matching the status filter already used for the withdrawal-events
  // fetch above) — a still-open draft hasn't actually happened yet.
  const r3FlaggedDocuments = [
    ...(depositResult.data ?? [])
      .filter((req) => req.requires_r3_document)
      .map((req) => ({ id: req.id, date: requestReceiptDateById.get(req.id) ?? null })),
    ...(withdrawalResult.data ?? [])
      .filter((req) => req.requires_r3_document)
      .map((req) => ({ id: req.id, date: req.requested_dispatch_date ?? null })),
  ];

  return {
    depositLines, depositRequestIds, withdrawalRequestIds, rates: ratesResult.data ?? [],
    requestReceiptDateById, requestDispatchDateById, r3FlaggedDocuments, error: null,
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Builds YYYY-MM-DD strings straight from local Date getters (never
// .toISOString(), which converts to UTC first) — under a positive UTC
// offset (e.g. Bangkok, UTC+7), midnight local on the 1st is still the
// previous day in UTC, so an ISO round-trip silently shifted every
// month's boundaries back by one day.
function monthRangeDates(monthsBack) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const curDay = now.getDate();
  const ranges = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const targetIndex = curMonth - i;
    const y = curYear + Math.floor(targetIndex / 12);
    const m = ((targetIndex % 12) + 12) % 12;
    const isCurrentMonth = y === curYear && m === curMonth;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const endDay = isCurrentMonth ? curDay : daysInMonth;
    ranges.push({
      monthKey: `${y}-${pad2(m + 1)}`,
      periodStart: `${y}-${pad2(m + 1)}-01`,
      periodEnd: `${y}-${pad2(m + 1)}-${pad2(endDay)}`,
    });
  }
  return ranges;
}

// Dashboard KPI: estimated STORAGE revenue (the customer's rental fee for
// space in the cold store, distinct from handling/other operation charges)
// for the current month and each of the last `monthsBack` months. Reuses
// computeStorageInvoiceLines -- the exact same weight-days proration engine
// that generates real invoice drafts -- so this is a genuine per-month
// reconstruction from each lot's actual receipt date and withdrawal
// history, not a flat "today's stock x days" guess. Still an estimate: it
// reflects lots/rates as configured *today*, and a lot fully withdrawn
// before its billing was ever drafted has no persisted record to recompute
// against for prior months.
export async function getMonthlyStorageRevenueSummary({ monthsBack = 6 } = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const [depositResult, withdrawalResult, ratesResult, catalogResult, customersResult] = await Promise.all([
    supabase
      .from('tgd_customer_deposit_requests')
      .select(`
        id, customer_id, expected_arrival_date, last_action_at,
        tgd_customer_deposit_request_lines(
          id, customer_product_code, temperature_type, tracking_code, lot_no,
          actual_boxes, actual_weight, expected_boxes, expected_weight
        )
      `)
      .in('status', ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED']),
    supabase
      .from('tgd_customer_withdrawal_requests')
      .select(`
        id, customer_id,
        tgd_customer_withdrawal_request_lines(
          source_customer_deposit_request_line_id, tracking_code, customer_product_code,
          picked_boxes, picked_weight, picked_at
        )
      `)
      .eq('status', 'COMPLETED'),
    listAllProductServiceRates({ serviceType: 'STORAGE', isActive: true }),
    listCustomerProducts({}),
    supabase.from('tgd_customers').select('id, customer_code, customer_name'),
  ]);

  if (depositResult.error) return { data: null, error: depositResult.error };
  if (withdrawalResult.error) return { data: null, error: withdrawalResult.error };
  if (ratesResult.error) return { data: null, error: ratesResult.error };
  if (catalogResult.error) return { data: null, error: catalogResult.error };
  if (customersResult.error) return { data: null, error: customersResult.error };

  const customerNameById = new Map(
    (customersResult.data ?? []).map((c) => [c.id, c.customer_name ?? c.customer_code ?? c.id]),
  );

  // Keyed by customer_id + code (not just code, unlike buildCatalogMaps)
  // -- across different customers the same code string is a coincidence,
  // not the same product, so a per-code-only map would cross-contaminate
  // temperature_type/product_id between two unrelated customers' items.
  const catalogByKey = new Map();
  for (const row of catalogResult.data ?? []) {
    if (!row.customer_product_code) continue;
    catalogByKey.set(`${row.customer_id}::${row.customer_product_code}`, row);
  }

  const rawDepositLines = [];
  for (const req of (depositResult.data ?? [])) {
    const receiptDate = req.expected_arrival_date ?? (req.last_action_at ? String(req.last_action_at).split('T')[0] : null);
    for (const line of (req.tgd_customer_deposit_request_lines ?? [])) {
      rawDepositLines.push({ ...line, customer_id: req.customer_id, receipt_date: receiptDate });
    }
  }

  const rawWithdrawalLines = [];
  for (const req of (withdrawalResult.data ?? [])) {
    for (const line of (req.tgd_customer_withdrawal_request_lines ?? [])) {
      rawWithdrawalLines.push({ ...line, customer_id: req.customer_id });
    }
  }

  const withdrawalEventsByLine = buildWithdrawalEventsByLine(rawDepositLines, rawWithdrawalLines);

  const depositLines = rawDepositLines.map((line) => {
    const catalogRow = catalogByKey.get(`${line.customer_id}::${line.customer_product_code}`);
    return {
      id: line.id,
      customer_id: line.customer_id,
      customer_product_id: catalogRow?.id ?? null,
      temperature_type: catalogRow?.temperature_type ?? line.temperature_type ?? null,
      received_weight: Number(line.actual_weight ?? line.expected_weight ?? 0),
      receipt_date: line.receipt_date,
      withdrawal_events: withdrawalEventsByLine.get(line.id) ?? [],
    };
  });

  const rates = ratesResult.data ?? [];
  const months = monthRangeDates(monthsBack).map(({ monthKey, periodStart, periodEnd }) => {
    const lines = computeStorageInvoiceLines({ depositLines, rates, periodStart, periodEnd });
    const amount = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

    const amountByCustomer = new Map();
    for (const line of lines) {
      const key = line.customerId ?? 'UNASSIGNED';
      amountByCustomer.set(key, (amountByCustomer.get(key) ?? 0) + (Number(line.amount) || 0));
    }
    const byCustomer = [...amountByCustomer.entries()]
      .map(([customerId, custAmount]) => ({
        customerId,
        customerName: customerNameById.get(customerId) ?? customerId,
        amount: Math.round(custAmount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { monthKey, periodStart, periodEnd, amount: Math.round(amount * 100) / 100, byCustomer };
  });

  const currentMonth = months[months.length - 1] ?? null;
  const totalAmount = Math.round(months.reduce((sum, m) => sum + m.amount, 0) * 100) / 100;

  return { data: { months, currentMonth, totalAmount }, error: null };
}

// Computes the storage + auxiliary-service invoice lines a customer would
// be billed for a given period, using the exact same rate configuration
// admins set up on the Product Service Rates page. Read-only preview —
// callers decide whether/how to persist these as actual invoice draft lines.
export async function getBillingPeriodPreview({ customerId, periodStart, periodEnd, temperatureType = null }) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId || !periodStart || !periodEnd) {
    return { data: null, error: new Error('customerId, periodStart, and periodEnd are required.') };
  }

  const inputs = await fetchRateEngineInputs({ customerId });
  if (inputs.error) return { data: null, error: inputs.error };
  const {
    depositLines: allDepositLines, depositRequestIds, withdrawalRequestIds, rates,
    requestReceiptDateById, requestDispatchDateById, r3FlaggedDocuments,
  } = inputs;

  // Storage/ค่าฝาก is billed per lot, and each lot has its own storage
  // method (temperature_type) — scoping to one lets staff bill e.g. only
  // FROZEN lots for a period, separately from CHILLED, when a customer
  // wants those split. Auxiliary services and the ร.3 fee below are
  // recorded per deposit REQUEST rather than per line/product, so they
  // have no single temperature to scope by and are always included in
  // full regardless of this filter.
  const scopedDepositLines = temperatureType
    ? allDepositLines.filter((dl) => dl.temperature_type === temperatureType)
    : allDepositLines;

  // A line with no real received amount (received_weight resolves to
  // actual_weight ?? expected_weight ?? 0 -- see fetchRateEngineInputs --
  // so this is 0 only when actual_weight/actual_boxes were themselves
  // recorded as 0, or nothing was ever entered at all) has nothing to
  // charge for and nothing to flag: it's not "unrated," it's just empty.
  // Confirmed real case: two TGM lines both RECEIVED_CONFIRMED at the
  // document level but recorded actual_boxes=0/actual_weight=0 on the line
  // itself (likely removed/zeroed during receiving without deleting the
  // row) kept showing up in the "no rate configured" warning even though
  // there was nothing to bill either way -- confusing staff into thinking
  // a rate needed setting up for a lot that was never actually received.
  const depositLines = scopedDepositLines.filter((dl) => Number(dl.received_weight) > 0);

  const storageLines = computeStorageInvoiceLines({
    depositLines,
    rates,
    periodStart,
    periodEnd,
  });

  // computeStorageInvoiceLines silently `continue`s past any deposit line
  // resolveServiceRate can't match a STORAGE rate for (see the identical
  // gap tracked as unratedLots in getAutoLotBillingPreview below) -- redo
  // just the rate-resolution half of its check here so a lot with no
  // configured/matching rate is visible in the preview instead of simply
  // being absent from storageLines with no explanation. asOfDate uses each
  // line's own receipt_date, matching exactly what computeStorageInvoiceLines
  // itself now checks internally (see billingRateCalc.js), so a line that's
  // unrated because its contract window doesn't cover its receipt date shows
  // up here with the correct reason instead of silently vanishing.
  const unratedDepositLines = depositLines
    .filter((dl) => !resolveStorageRateForLine(rates, dl, dl.receipt_date))
    .map((dl) => ({
      depositLineId: dl.id,
      lotNo: dl.lot_no,
      customerProductCode: dl.customer_product_code,
      temperatureType: dl.temperature_type,
      weight: dl.received_weight,
      reason: classifyUnratedReason(rates, dl, dl.receipt_date),
    }));

  // HANDLING_IN (ค่าบริการจัดการแรกเข้า): one-time, weight-based fee charged
  // only when a lot is first received (see computeHandlingFeeLines) —
  // confirmed against a real customer's accounting spreadsheet as a
  // material fee component that was previously invisible to this preview
  // entirely. Silently produces nothing for a customer with no HANDLING_IN
  // rate configured, same as any other optional service type.
  const handlingLines = computeHandlingFeeLines({
    depositLines, rates, periodStart, periodEnd, serviceType: 'HANDLING_IN',
  });

  // FREEZING (ค่าฟรีส): same one-time weight-based fee mechanism as
  // HANDLING_IN above, scoped to only the FREEZE_FROZEN lots -- these are
  // billed for STORAGE under the FROZEN rate bucket (resolveStorageRateForLine)
  // since physically they sit in the same frozen room, but the freezing
  // service itself is a real, separate cost that must show as its own line
  // rather than being folded into (or lost from) the storage charge.
  const freezeFrozenLines = depositLines.filter((dl) => dl.temperature_type === 'FREEZE_FROZEN');
  const freezingLines = computeHandlingFeeLines({
    depositLines: freezeFrozenLines, rates, periodStart, periodEnd, serviceType: 'FREEZING',
  });

  // Scope the aux-service lookup to requests whose receipt/dispatch date
  // actually falls in this billing period *before* querying, not after.
  // depositRequestIds/withdrawalRequestIds cover a customer's entire
  // history (fetchRateEngineInputs deliberately doesn't date-filter, since
  // storage-cycle tracking needs full history) — querying with the full
  // list as a `.in(...)` filter builds a GET URL whose length scales with
  // total lifetime request count. For a customer with enough volume (seen
  // with a real customer at 388 withdrawal requests) that URL exceeds
  // Kong/nginx's ~8KB request-line limit and the request is rejected with
  // a raw 414 before it ever reaches PostgREST — surfacing to the browser
  // as an unhelpful "TypeError: Failed to fetch" instead of any usable
  // error. Pre-filtering to just this period's request IDs keeps the
  // query small regardless of how much history a customer accumulates.
  const periodDepositRequestIds = depositRequestIds.filter((id) => {
    const date = requestReceiptDateById.get(id);
    return date && date >= periodStart && date <= periodEnd;
  });
  const periodWithdrawalRequestIds = withdrawalRequestIds.filter((id) => {
    const date = requestDispatchDateById.get(id);
    return date && date >= periodStart && date <= periodEnd;
  });

  // Belt-and-braces on top of the period pre-filter above: even one
  // period's worth of requests could exceed a safe URL length for a very
  // high-volume customer, so chunk the same way the lot-cycle lookup below
  // already does (REQUEST_ID_CHUNK_SIZE mirrors that file's LOT_ID_CHUNK_SIZE).
  const REQUEST_ID_CHUNK_SIZE = 150;

  let auxLines = [];
  if (periodDepositRequestIds.length > 0) {
    const rateById = new Map(rates.map((r) => [r.id, r]));
    const auxRows = [];
    for (const chunk of chunkArray(periodDepositRequestIds, REQUEST_ID_CHUNK_SIZE)) {
      // eslint-disable-next-line no-await-in-loop
      const auxResult = await supabase
        .from('tgd_customer_deposit_request_services')
        .select('id, deposit_request_id, service_rate_id, quantity, note')
        .in('deposit_request_id', chunk);
      if (auxResult.error) return { data: null, error: auxResult.error };
      auxRows.push(...(auxResult.data ?? []));
    }

    const selections = auxRows
      .map((row) => ({
        sourceRequestId: row.deposit_request_id,
        customerId,
        rate: rateById.get(row.service_rate_id),
        quantity: row.quantity,
        note: row.note,
        selectionId: row.id,
      }))
      .filter((sel) => sel.rate);

    auxLines = computeAuxiliaryServiceLines({ selections });
  }

  // Withdrawal-side auxiliary services (plug-in/OT/etc. selected against a
  // withdrawal request rather than a deposit — see
  // tgd_customer_withdrawal_request_services) — exact mirror of the
  // deposit-side block above, feeding into the same auxLines array so both
  // sides get identical invoice-draft-line/report treatment downstream.
  if (periodWithdrawalRequestIds.length > 0) {
    const rateById = new Map(rates.map((r) => [r.id, r]));
    const withdrawalAuxRows = [];
    for (const chunk of chunkArray(periodWithdrawalRequestIds, REQUEST_ID_CHUNK_SIZE)) {
      // eslint-disable-next-line no-await-in-loop
      const withdrawalAuxResult = await supabase
        .from('tgd_customer_withdrawal_request_services')
        .select('id, withdrawal_request_id, service_rate_id, quantity, note')
        .in('withdrawal_request_id', chunk);
      if (withdrawalAuxResult.error) return { data: null, error: withdrawalAuxResult.error };
      withdrawalAuxRows.push(...(withdrawalAuxResult.data ?? []));
    }

    const withdrawalSelections = withdrawalAuxRows
      .map((row) => ({
        sourceRequestId: row.withdrawal_request_id,
        customerId,
        rate: rateById.get(row.service_rate_id),
        quantity: row.quantity,
        note: row.note,
        selectionId: row.id,
      }))
      .filter((sel) => sel.rate);

    auxLines = [...auxLines, ...computeAuxiliaryServiceLines({ selections: withdrawalSelections })];
  }

  // ร.3 document fee: one flat line per flagged deposit/withdrawal request
  // whose confirmation date falls in this period, always quantity 1 — a
  // fixed per-document fee, not something that scales with unit_basis math
  // elsewhere (see the incident note on the migration that introduced this
  // flag: the automatic engine ignores unit_basis and would otherwise
  // multiply by weight).
  const r3Rate = resolveServiceRate(rates, { customerId, serviceType: 'R3_DOCUMENT' });
  if (r3Rate) {
    const r3Selections = (r3FlaggedDocuments ?? [])
      .filter((doc) => doc.date && doc.date >= periodStart && doc.date <= periodEnd)
      .map((doc) => ({
        sourceRequestId: doc.id,
        customerId,
        rate: r3Rate,
        quantity: 1,
      }));
    auxLines = [...auxLines, ...computeAuxiliaryServiceLines({ selections: r3Selections })];
  }

  return {
    data: {
      storageLines, auxLines, handlingLines: [...handlingLines, ...freezingLines], depositLines, unratedDepositLines,
    },
    error: null,
  };
}

// Auto per-lot billing preview: instead of one staff-typed date range
// applied to every lot, each lot with a RECURRING storage rate (period_days
// set) is billed in its own period_days-sized cycles counted from its own
// receipt date, resuming from wherever it was last billed through — see
// generateLotBillingCycles. One-time fees (period_days null) have no
// per-lot cycle concept and are not included here; they stay on the
// existing getBillingPeriodPreview/manual flow only.
//
// A lot with no known "billed through" date (never billed under this auto
// flow, and no one-time seed recorded in tgd_lot_billing_cutoff_overrides)
// is returned with needsSetup: true and no cycles — the caller must have
// staff record a starting cutoff (saveLotBillingCutoffSeed) before this lot
// can be included, so a lot already billed under the old manual date-range
// flow (which never tagged deposit_line_id) can't be silently re-billed
// from its original receipt date.
export async function getAutoLotBillingPreview({ customerId, billThroughDate, temperatureType = null }) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId || !billThroughDate) {
    return { data: null, error: new Error('customerId and billThroughDate are required.') };
  }

  const inputs = await fetchRateEngineInputs({ customerId });
  if (inputs.error) return { data: null, error: inputs.error };
  const { depositLines: allDepositLines, rates } = inputs;
  // Same per-lot storage-method scoping as getBillingPeriodPreview above.
  const scopedDepositLines = temperatureType
    ? allDepositLines.filter((dl) => dl.temperature_type === temperatureType)
    : allDepositLines;
  // Same zero-received-amount exclusion as getBillingPeriodPreview -- a line
  // recorded with actual_boxes=0/actual_weight=0 has nothing to bill and
  // isn't a real "unrated" gap either.
  const depositLines = scopedDepositLines.filter((dl) => Number(dl.received_weight) > 0);

  // A lot resolveServiceRate can't match at all (no rate configured for
  // this customer/temperature combination, or a temperature_type that's
  // gone null/unresolved -- e.g. after a catalog recode, see this
  // session's several product-code fixes -- with no customer-wide
  // generic STORAGE rate to fall back to) used to just vanish from
  // recurringLots with nothing to indicate it was ever considered. Track
  // it separately so staff can see it's silently excluded from every
  // billing preview, the same visibility needsSetup already gives lots
  // missing a billed-through date.
  const recurringLots = [];
  const unratedLots = [];
  for (const dl of depositLines) {
    const rate = resolveStorageRateForLine(rates, dl, billThroughDate);
    if (rate && rate.period_days != null) {
      recurringLots.push({ depositLine: dl, rate });
    } else if (!rate) {
      unratedLots.push({
        depositLineId: dl.id,
        lotNo: dl.lot_no,
        customerProductCode: dl.customer_product_code,
        temperatureType: dl.temperature_type,
        weight: dl.received_weight,
        reason: classifyUnratedReason(rates, dl, billThroughDate),
      });
    }
  }

  if (recurringLots.length === 0) {
    return { data: { lots: [], depositLines: [], unratedLots }, error: null };
  }

  const lotIds = recurringLots.map((r) => r.depositLine.id);

  // A customer with hundreds of storage-billed lots (a real one has 300+)
  // turns .in('deposit_line_id', lotIds) into a GET request whose query
  // string is tens of thousands of characters long — the server rejects
  // that outright with a 400 Bad Request before it ever reaches the
  // filter logic. Same class of bug as getDepositInventoryLines' own
  // "customer's id via the join instead" fix; chunking the id list into
  // batches keeps each request's URL well under any practical limit,
  // regardless of how many lots this customer has.
  const LOT_ID_CHUNK_SIZE = 150;
  const lotIdChunks = chunkArray(lotIds, LOT_ID_CHUNK_SIZE);

  const priorLinesRows = [];
  const seedRows = [];
  for (const chunk of lotIdChunks) {
    // eslint-disable-next-line no-await-in-loop
    const [priorLinesResult, seedResult] = await Promise.all([
      supabase
        .from(INVOICE_DRAFT_LINE_TABLE)
        .select('deposit_line_id, billing_period_end, tgd_billing_invoice_drafts!inner(status)')
        .in('deposit_line_id', chunk)
        .not('billing_period_end', 'is', null)
        .in('tgd_billing_invoice_drafts.status', NON_CANCELLED_INVOICE_DRAFT_STATUSES),
      supabase
        .from('tgd_lot_billing_cutoff_overrides')
        .select('deposit_line_id, billed_through_date')
        .in('deposit_line_id', chunk),
    ]);

    if (priorLinesResult.error) return { data: null, error: priorLinesResult.error };
    if (seedResult.error) return { data: null, error: seedResult.error };

    priorLinesRows.push(...(priorLinesResult.data ?? []));
    seedRows.push(...(seedResult.data ?? []));
  }

  const maxBilledThroughByLot = new Map();
  for (const row of priorLinesRows) {
    const current = maxBilledThroughByLot.get(row.deposit_line_id);
    if (!current || row.billing_period_end > current) {
      maxBilledThroughByLot.set(row.deposit_line_id, row.billing_period_end);
    }
  }
  const seedByLot = new Map(seedRows.map((r) => [r.deposit_line_id, r.billed_through_date]));

  const lots = recurringLots.map(({ depositLine, rate }) => {
    const billedThroughDate = maxBilledThroughByLot.get(depositLine.id) ?? seedByLot.get(depositLine.id) ?? null;

    if (!billedThroughDate) {
      return {
        depositLineId: depositLine.id,
        lotNo: depositLine.lot_no,
        customerProductCode: depositLine.customer_product_code,
        receiptDate: depositLine.receipt_date,
        needsSetup: true,
        billedThroughDate: null,
        cycles: [],
      };
    }

    const cycleWindows = generateLotBillingCycles({
      receiptDate: depositLine.receipt_date,
      periodDays: rate.period_days,
      billedThroughDate,
      billThroughDate,
    });

    const cycles = cycleWindows
      .map((window) => {
        const [computed] = computeStorageInvoiceLines({
          depositLines: [depositLine],
          rates: [rate],
          periodStart: window.start,
          periodEnd: window.end,
        });
        return computed ? { ...computed, periodStart: window.start, periodEnd: window.end } : null;
      })
      .filter(Boolean);

    return {
      depositLineId: depositLine.id,
      lotNo: depositLine.lot_no,
      customerProductCode: depositLine.customer_product_code,
      receiptDate: depositLine.receipt_date,
      needsSetup: false,
      billedThroughDate,
      cycles,
    };
  });

  return { data: { lots, depositLines: recurringLots.map((r) => r.depositLine), unratedLots }, error: null };
}

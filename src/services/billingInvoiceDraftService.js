import { supabase } from './supabaseClient.js';
import {
  getBillingMovementWeightRows,
  shapeBillingMovementWeightRow,
  enrichClientMergedBillingMovementWeightRow,
} from './billingMovementWeightService.js';
import {
  getConfirmedDepositReceiptRows,
  getConfirmedWithdrawalRows,
  getStorageOpeningBalanceRows,
} from './movementLedgerReportService.js';
import {
  ACTIVE_INVOICE_DRAFT_STATUSES,
  APPROVABLE_INVOICE_DRAFT_STATUSES,
  CANCELLABLE_INVOICE_DRAFT_STATUSES,
  INVOICE_DRAFT_LINE_TABLE,
  INVOICE_DRAFT_STATUS,
  INVOICE_DRAFT_TABLE,
  buildBillingInvoiceDraftNo,
  buildInvoiceDraftCreatePayload,
  buildInvoiceDraftLineFromStorageLine,
  buildInvoiceDraftLineFromAuxiliaryLine,
  calculateInvoiceDraftTotals,
  canApproveBillingInvoiceDraft,
  canCancelBillingInvoiceDraft,
  canDeleteBillingInvoiceDraft,
  findDuplicateDraftLines,
  shapeBillingInvoiceDraftHeader,
  shapeBillingInvoiceDraftLine,
} from '../utils/billingInvoiceDraftUtils.js';
import { getBillingPeriodPreview, getAutoLotBillingPreview, buildCatalogMaps } from './billingRateEngineService.js';
import { listAllProductServiceRates } from './productServiceRatesService.js';
import { listCustomerProducts } from './customerProductCatalogService.js';
import { resolveServiceRate } from '../utils/billingRateCalc.js';
import { round2 } from '../utils/numberFormat.js';
import { getCustomers } from './masterDataService.js';
import {
  evaluateInvoiceDraftBplusExportReadiness,
  normalizeCustomerForBplusReadiness,
} from '../utils/billingInvoiceDraftBplusExportUtils.js';
import {
  isBillingInvoiceDraftPermissionError,
} from '../utils/billingInvoiceDraftUtils.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function validationError(message, details = {}) {
  const error = new Error(message);
  error.code = 'INVOICE_DRAFT_VALIDATION';
  error.details = details;
  return error;
}

function normalizeServiceError(error) {
  if (!error || !isBillingInvoiceDraftPermissionError(error)) {
    return error;
  }

  const normalized = new Error('You do not have permission to access billing invoice drafts.');
  normalized.code = 'INVOICE_DRAFT_PERMISSION_DENIED';
  return normalized;
}

async function resolveDraftNo() {
  if (!supabase) return buildBillingInvoiceDraftNo();

  const rpcResult = await supabase.rpc('tgd_next_billing_invoice_draft_no');
  if (!rpcResult.error && rpcResult.data) {
    return rpcResult.data;
  }

  return buildBillingInvoiceDraftNo(Date.now() % 10000);
}

const OPENING_BALANCE_ID_PATTERN = /^opening-(.+)-asof-(\d{4}-\d{2}-\d{2})$/;

// Resolves opening-<depositLineId>-asof-<date> synthetic ids (see
// getStorageOpeningBalanceRows) back into real rows. These ids don't
// correspond to a persisted movement record — they encode a deposit line
// id and an as-of date, so the balance is deterministically recomputed
// from those two facts here rather than trusted from whatever the client
// last displayed, guaranteeing what actually gets billed matches the
// current deposit/withdrawal data at creation time.
async function resolveOpeningBalanceIds(ids = []) {
  const parsed = ids
    .map((id) => {
      const match = OPENING_BALANCE_ID_PATTERN.exec(id);
      return match ? { id, lineId: match[1], asOfDate: match[2] } : null;
    })
    .filter(Boolean);
  if (parsed.length === 0) return new Map();

  const lineIds = [...new Set(parsed.map((p) => p.lineId))];
  const { data: lines, error } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id, deposit_request_id, tgd_customer_deposit_requests(customer_id)')
    .in('id', lineIds);
  if (error || !lines) return new Map();

  const customerByLineId = new Map(
    lines.map((line) => [line.id, line.tgd_customer_deposit_requests?.customer_id]),
  );

  const groups = new Map();
  for (const p of parsed) {
    const customerId = customerByLineId.get(p.lineId);
    if (!customerId) continue;
    const key = `${customerId}|${p.asOfDate}`;
    if (!groups.has(key)) groups.set(key, { customerId, asOfDate: p.asOfDate });
  }

  const resultMap = new Map();
  await Promise.all([...groups.values()].map(async ({ customerId, asOfDate }) => {
    const { data: rows } = await getStorageOpeningBalanceRows(customerId, asOfDate);
    for (const row of (rows ?? [])) {
      resultMap.set(String(row.id), enrichClientMergedBillingMovementWeightRow(row));
    }
  }));

  return resultMap;
}

async function fetchMovementsByIds(movementIds = []) {
  const normalizedIds = [...new Set((movementIds ?? []).map((id) => String(id)).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return { data: [], error: null };
  }

  const openingIds = normalizedIds.filter((id) => OPENING_BALANCE_ID_PATTERN.test(id));

  // The report page merges rows from three sources (see
  // BillingMovementWeightReportPage.jsx): the legacy billing movement
  // weight view/unified movements table, the customer deposit/withdrawal
  // request tables, and computed storage opening-balance rows. Draft
  // creation has to be able to re-resolve an id from whichever of those
  // the user actually selected, or a row that's fully visible and
  // selectable on screen would fail here with "not found in billing
  // source" the moment Create Draft is clicked.
  const [viewResult, depositResult, withdrawalResult, openingRowsById] = await Promise.all([
    getBillingMovementWeightRows({ billableOnly: false }),
    getConfirmedDepositReceiptRows({}),
    getConfirmedWithdrawalRows({}),
    resolveOpeningBalanceIds(openingIds),
  ]);

  if (viewResult.error) return { data: null, error: viewResult.error };
  if (depositResult.error) return { data: null, error: depositResult.error };
  if (withdrawalResult.error) return { data: null, error: withdrawalResult.error };

  const rowsById = new Map();
  for (const row of (viewResult.data ?? [])) {
    rowsById.set(String(row.movement_id), shapeBillingMovementWeightRow(row));
  }
  for (const row of [...(depositResult.data ?? []), ...(withdrawalResult.data ?? [])]) {
    rowsById.set(String(row.id), enrichClientMergedBillingMovementWeightRow(row));
  }
  for (const [id, row] of openingRowsById) {
    rowsById.set(id, row);
  }

  const missingIds = normalizedIds.filter((id) => !rowsById.has(id));
  if (missingIds.length > 0) {
    return {
      data: null,
      error: validationError('Some selected movements were not found in billing source.', { missingIds }),
    };
  }

  return {
    data: normalizedIds.map((id) => rowsById.get(id)),
    error: null,
  };
}

const RATE_SERVICE_TYPES = new Set(['STORAGE', 'HANDLING_IN', 'HANDLING_OUT', 'LABEL', 'FREEZING', 'OTHER']);

// enrichClientMergedBillingMovementWeightRow classifies deposit/withdrawal
// rows as INBOUND_HANDLING/OUTBOUND_HANDLING (see billingMovementWeightService.js)
// — translate those into the rate card's own service_type vocabulary
// (tgd_customer_product_service_rates.service_type check constraint) so a
// configured rate can actually be looked up for the row.
function toRateServiceType(billingServiceType) {
  const value = String(billingServiceType ?? '').toUpperCase();
  if (RATE_SERVICE_TYPES.has(value)) return value;
  if (value === 'INBOUND_HANDLING') return 'HANDLING_IN';
  if (value === 'OUTBOUND_HANDLING') return 'HANDLING_OUT';
  return null;
}

// Movement rows selected on BillingMovementWeightReportPage never carry a
// resolved rate/amount (see buildInvoiceDraftLineFromMovement) — unlike the
// period-preview draft path (getBillingPeriodPreview), which resolves a
// rate per deposit line via the same rate engine. This looks up the
// customer's configured service rate for each movement the same way, using
// whichever of customer_product_code/temperature_type the row's source
// (deposit/withdrawal/opening-balance — see movementLedgerReportService.js)
// carried through billingMovementWeightService.js's shaping. Rows from the
// raw unified-movements view (adjustments/transfers) have no
// customer_product_code to resolve against and are left with rate: null,
// same as before.
async function resolveMovementRates(movements = []) {
  const customerIds = [...new Set(movements.map((m) => m.customer_id).filter(Boolean))];
  if (customerIds.length === 0) return movements;

  const ratesByCustomer = new Map();
  const catalogByCustomer = new Map();
  await Promise.all(customerIds.map(async (customerId) => {
    // Best-effort: a rate-lookup failure shouldn't block creating the draft
    // itself — it just means these movements keep rate/amount null, same
    // as before this lookup existed.
    try {
      const [ratesResult, catalogResult] = await Promise.all([
        listAllProductServiceRates({ customerId, isActive: true }),
        listCustomerProducts({ customerId }),
      ]);
      ratesByCustomer.set(customerId, ratesResult?.data ?? []);
      catalogByCustomer.set(customerId, buildCatalogMaps(catalogResult?.data ?? []));
    } catch {
      ratesByCustomer.set(customerId, []);
      catalogByCustomer.set(customerId, buildCatalogMaps([]));
    }
  }));

  return movements.map((movement) => {
    if (movement.rate != null) return movement;

    const serviceType = toRateServiceType(movement.billing_service_type);
    if (!serviceType) return movement;

    const catalogMaps = catalogByCustomer.get(movement.customer_id);
    const customerProductId = movement.customer_product_code
      ? catalogMaps?.productIdByCode.get(movement.customer_product_code) ?? null
      : null;
    const temperatureType = movement.temperature_type
      ?? (movement.customer_product_code ? catalogMaps?.temperatureTypeByCode.get(movement.customer_product_code) : null)
      ?? null;

    const rate = resolveServiceRate(ratesByCustomer.get(movement.customer_id) ?? [], {
      customerId: movement.customer_id,
      customerProductId,
      temperatureType,
      serviceType,
    });
    if (!rate) return movement;

    return { ...movement, rate: rate.rate != null ? Number(rate.rate) : null, service_rate_id: rate.id ?? null };
  });
}

export async function findActiveDuplicateDraftLines(movementIds = []) {
  if (!supabase) return missingSupabaseClientResult();

  const normalizedIds = [...new Set((movementIds ?? []).map((id) => String(id)).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return { data: [], error: null };
  }

  const result = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .select('id, invoice_draft_id, source_movement_id, duplicate_guard_active')
    .eq('duplicate_guard_active', true)
    .in('source_movement_id', normalizedIds);

  if (result.error) {
    return { data: null, error: normalizeServiceError(result.error) };
  }

  return {
    data: findDuplicateDraftLines(normalizedIds, result.data ?? []),
    error: null,
  };
}

// Storage/service-period drafts have no per-movement source id to check
// against (unlike findActiveDuplicateDraftLines, used for movement-based
// drafts) — a period draft is scoped to a customer + date range instead, so
// the duplicate check here is a date-range overlap against that customer's
// other still-active drafts. Without this, nothing stops staff from billing
// e.g. 1-15 and then again 10-20 for the same customer, double-charging the
// overlapping days silently.
export async function findOverlappingBillingPeriodDrafts({ customerId, billingPeriodStart, billingPeriodEnd, excludeDraftId = null }) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId || !billingPeriodStart || !billingPeriodEnd) {
    return { data: [], error: null };
  }

  // A null billing_period_start/end (movement-based drafts, where the period
  // is optional) never satisfies these comparisons in Postgres, so those
  // rows are excluded from the overlap check without needing an explicit
  // "is not null" filter.
  let query = supabase
    .from(INVOICE_DRAFT_TABLE)
    .select('id, draft_no, billing_period_start, billing_period_end, status')
    .eq('customer_id', customerId)
    .in('status', ACTIVE_INVOICE_DRAFT_STATUSES)
    .lte('billing_period_start', billingPeriodEnd)
    .gte('billing_period_end', billingPeriodStart);

  if (excludeDraftId) query = query.neq('id', excludeDraftId);

  const result = await query;
  if (result.error) {
    return { data: null, error: normalizeServiceError(result.error) };
  }

  return { data: result.data ?? [], error: null };
}

export async function listBillingInvoiceDrafts(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  let query = supabase
    .from(INVOICE_DRAFT_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.statusIn?.length) query = query.in('status', filters.statusIn);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

  const result = await query;
  if (result.error) {
    return { data: null, error: normalizeServiceError(result.error) };
  }

  return {
    data: (result.data ?? []).map(shapeBillingInvoiceDraftHeader),
    error: null,
  };
}

export async function getBillingInvoiceDraftById(id) {
  if (!supabase) return missingSupabaseClientResult();
  if (!id) {
    return { data: null, error: validationError('Invoice draft id is required.') };
  }

  const headerResult = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (headerResult.error) {
    return { data: null, error: normalizeServiceError(headerResult.error) };
  }

  if (!headerResult.data) {
    return { data: null, error: validationError('Invoice draft not found.', { draftId: id }) };
  }

  const linesResult = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .select('*')
    .eq('invoice_draft_id', id)
    .order('created_at', { ascending: true });

  if (linesResult.error) {
    return { data: null, error: normalizeServiceError(linesResult.error) };
  }

  return {
    data: {
      draft: shapeBillingInvoiceDraftHeader(headerResult.data),
      lines: (linesResult.data ?? []).map(shapeBillingInvoiceDraftLine),
    },
    error: null,
  };
}

// Backfills rate/amount on an existing draft's lines that predate the rate
// lookup in resolveMovementRates/createBillingInvoiceDraftFromMovements —
// those lines were persisted with rate/amount always null. Only lines
// still missing a rate and with a source_movement_id are touched (storage/
// auxiliary lines already resolve a rate at creation time; a line with no
// source_movement_id has nothing to re-fetch). Re-derives the movement
// fresh from its original source (deposit/withdrawal/opening-balance) via
// fetchMovementsByIds so customer_product_code/temperature_type are
// available again, exactly as if the draft were being created now.
export async function recalculateInvoiceDraftLineRates(draftId) {
  if (!supabase) return missingSupabaseClientResult();
  if (!draftId) return { data: null, error: validationError('Invoice draft id is required.') };

  const draftResult = await getBillingInvoiceDraftById(draftId);
  if (draftResult.error) return { data: null, error: draftResult.error };

  const { draft, lines } = draftResult.data;
  if (!CANCELLABLE_INVOICE_DRAFT_STATUSES.includes(draft.status)) {
    return {
      data: null,
      error: validationError('Invoice draft is no longer editable and cannot be recalculated.', {
        status: draft.status,
      }),
    };
  }

  const linesNeedingRate = lines.filter((l) => l.rate == null && l.source_movement_id);

  let updatedCount = 0;
  const lineUpdateErrors = [];

  if (linesNeedingRate.length > 0) {
    const movementIds = [...new Set(linesNeedingRate.map((l) => String(l.source_movement_id)))];
    const movementResult = await fetchMovementsByIds(movementIds);
    if (movementResult.error) {
      return { data: null, error: movementResult.error };
    }

    const ratedByMovementId = new Map(
      (await resolveMovementRates(movementResult.data)).map((m) => [String(m.movement_id), m]),
    );

    // Run line updates concurrently rather than one HTTP round-trip at a
    // time — a draft can have hundreds of lines, and awaiting them
    // sequentially took long enough in practice that a user closing/
    // reloading the tab partway through left the header total permanently
    // out of sync with the (successfully updated) lines.
    const results = await Promise.all(linesNeedingRate.map(async (line) => {
      const rated = ratedByMovementId.get(String(line.source_movement_id));
      if (!rated || rated.rate == null) return null;

      const amount = round2(Number(rated.rate) * Number(line.chargeable_weight ?? 0));
      const updateResult = await supabase
        .from(INVOICE_DRAFT_LINE_TABLE)
        .update({ rate: Number(rated.rate), amount, service_rate_id: rated.service_rate_id ?? null })
        .eq('id', line.id);
      return { error: updateResult.error };
    }));

    for (const result of results) {
      if (!result) continue;
      if (result.error) lineUpdateErrors.push(result.error);
      else updatedCount += 1;
    }
  }

  // Always resync the header total from the lines' current state, not just
  // when THIS call updated something — a prior run that updated lines but
  // got interrupted before this step (or a rerun once every line already
  // has a rate) would otherwise leave total_amount permanently stale/null.
  const refreshed = await getBillingInvoiceDraftById(draftId);
  if (refreshed.error) return { data: null, error: refreshed.error };

  const totals = calculateInvoiceDraftTotals(refreshed.data.lines);
  const headerUpdate = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .update({ total_amount: totals.total_amount })
    .eq('id', draftId)
    .select('*')
    .single();

  if (headerUpdate.error) {
    return { data: null, error: normalizeServiceError(headerUpdate.error) };
  }

  if (lineUpdateErrors.length > 0) {
    return {
      data: null,
      error: validationError(`Recalculated ${updatedCount} line(s), but ${lineUpdateErrors.length} failed to update.`, {
        updatedCount, failedCount: lineUpdateErrors.length,
      }),
    };
  }

  return {
    data: {
      draft: shapeBillingInvoiceDraftHeader(headerUpdate.data),
      lines: refreshed.data.lines,
      updatedCount,
    },
    error: null,
  };
}

export async function createBillingInvoiceDraftFromMovements({
  movementIds = [],
  billingPeriodStart = null,
  billingPeriodEnd = null,
  note = null,
  internalReference = null,
  createdBy = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const normalizedIds = [...new Set((movementIds ?? []).map((id) => String(id)).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return { data: null, error: validationError('At least one movement id is required.') };
  }

  const movementResult = await fetchMovementsByIds(normalizedIds);
  if (movementResult.error) {
    return { data: null, error: movementResult.error };
  }

  const duplicateResult = await findActiveDuplicateDraftLines(normalizedIds);
  if (duplicateResult.error) {
    return { data: null, error: duplicateResult.error };
  }

  if ((duplicateResult.data ?? []).length > 0) {
    return {
      data: null,
      error: validationError('One or more movements are already linked to an active invoice draft.', {
        duplicates: duplicateResult.data,
      }),
    };
  }

  const ratedMovements = await resolveMovementRates(movementResult.data);

  const draftNo = await resolveDraftNo();
  const payload = buildInvoiceDraftCreatePayload({
    draftNo,
    movements: ratedMovements,
    billingPeriodStart,
    billingPeriodEnd,
    note,
    internalReference,
    createdBy,
  });

  if (!payload.valid) {
    return {
      data: null,
      error: validationError(payload.errors.join(' '), { errors: payload.errors }),
    };
  }

  const headerInsert = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .insert(payload.header)
    .select('*')
    .single();

  if (headerInsert.error) {
    return { data: null, error: normalizeServiceError(headerInsert.error) };
  }

  const draftId = headerInsert.data.id;
  const lineRows = payload.lines.map((line) => ({
    ...line,
    invoice_draft_id: draftId,
  }));

  const linesInsert = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .insert(lineRows)
    .select('*');

  if (linesInsert.error) {
    return { data: null, error: normalizeServiceError(linesInsert.error) };
  }

  return {
    data: {
      draft: shapeBillingInvoiceDraftHeader(headerInsert.data),
      lines: (linesInsert.data ?? []).map(shapeBillingInvoiceDraftLine),
    },
    error: null,
  };
}

// Generates a draft's storage + auxiliary-service lines from the rate
// engine (see billingRateEngineService.js) for one customer over one
// billing period, instead of the manual "pick movement rows" flow above —
// storage charges span the whole period rather than a single movement, so
// they don't fit that flow. Returns a preview (no rate resolved / nothing
// to bill is reported via zero lines) so the caller can show it before
// committing, and a separate confirm step actually inserts it.
export async function previewBillingPeriodInvoice({ customerId, billingPeriodStart, billingPeriodEnd }) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId || !billingPeriodStart || !billingPeriodEnd) {
    return { data: null, error: validationError('customerId, billingPeriodStart, and billingPeriodEnd are required.') };
  }

  const previewResult = await getBillingPeriodPreview({
    customerId,
    periodStart: billingPeriodStart,
    periodEnd: billingPeriodEnd,
  });
  if (previewResult.error) return { data: null, error: previewResult.error };

  const { storageLines, auxLines, depositLines } = previewResult.data;
  const depositLineById = new Map(depositLines.map((dl) => [dl.id, dl]));

  const lines = [
    ...storageLines.map((sl) => buildInvoiceDraftLineFromStorageLine(sl, depositLineById.get(sl.depositLineId) ?? {})),
    ...auxLines.map((al) => buildInvoiceDraftLineFromAuxiliaryLine(al)),
  ];

  const totals = calculateInvoiceDraftTotals(lines);

  return { data: { lines, totals }, error: null };
}

export async function createBillingInvoiceDraftForPeriod({
  customerId,
  billingPeriodStart,
  billingPeriodEnd,
  note = null,
  internalReference = null,
  createdBy = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId || !billingPeriodStart || !billingPeriodEnd) {
    return { data: null, error: validationError('customerId, billingPeriodStart, and billingPeriodEnd are required.') };
  }

  const overlapResult = await findOverlappingBillingPeriodDrafts({ customerId, billingPeriodStart, billingPeriodEnd });
  if (overlapResult.error) return { data: null, error: overlapResult.error };

  if ((overlapResult.data ?? []).length > 0) {
    const draftNos = overlapResult.data.map((d) => d.draft_no).filter(Boolean).join(', ');
    return {
      data: null,
      error: validationError(`This customer already has an active invoice draft covering an overlapping billing period (${draftNos}).`, {
        overlapping: overlapResult.data,
      }),
    };
  }

  const preview = await previewBillingPeriodInvoice({ customerId, billingPeriodStart, billingPeriodEnd });
  if (preview.error) return { data: null, error: preview.error };

  if (preview.data.lines.length === 0) {
    return { data: null, error: validationError('No storage or service charges found for this customer/period.') };
  }

  const customersResult = await getCustomers();
  const customerName = (customersResult.data ?? []).find((c) => c.id === customerId)?.customer_name ?? null;

  const draftNo = await resolveDraftNo();
  const header = {
    draft_no: draftNo,
    customer_id: customerId,
    customer_name: customerName,
    billing_period_start: billingPeriodStart,
    billing_period_end: billingPeriodEnd,
    status: INVOICE_DRAFT_STATUS.DRAFT,
    ...preview.data.totals,
    currency: 'THB',
    note,
    internal_reference: internalReference,
    created_by: createdBy,
  };

  const headerInsert = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .insert(header)
    .select('*')
    .single();

  if (headerInsert.error) {
    return { data: null, error: normalizeServiceError(headerInsert.error) };
  }

  const draftId = headerInsert.data.id;
  const lineRows = preview.data.lines.map((line) => ({ ...line, invoice_draft_id: draftId }));

  const linesInsert = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .insert(lineRows)
    .select('*');

  if (linesInsert.error) {
    return { data: null, error: normalizeServiceError(linesInsert.error) };
  }

  return {
    data: {
      draft: shapeBillingInvoiceDraftHeader(headerInsert.data),
      lines: (linesInsert.data ?? []).map(shapeBillingInvoiceDraftLine),
    },
    error: null,
  };
}

// One-time per-lot seed for auto per-lot billing (see
// getAutoLotBillingPreview) — records "storage was already charged through
// this date" for a lot that predates the auto flow, so the first auto run
// for that lot resumes from here instead of either refusing to bill it or
// silently starting over from its receipt date (double-billing risk).
export async function saveLotBillingCutoffSeed({ depositLineId, billedThroughDate, note = null, setBy = null }) {
  if (!supabase) return missingSupabaseClientResult();
  if (!depositLineId || !billedThroughDate) {
    return { data: null, error: validationError('depositLineId and billedThroughDate are required.') };
  }

  const result = await supabase
    .from('tgd_lot_billing_cutoff_overrides')
    .upsert({
      deposit_line_id: depositLineId,
      billed_through_date: billedThroughDate,
      note,
      set_by_user_id: setBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'deposit_line_id' })
    .select('*')
    .single();

  if (result.error) {
    return { data: null, error: normalizeServiceError(result.error) };
  }
  return { data: result.data, error: null };
}

// Auto per-lot billing's duplicate guard: unlike findOverlappingBillingPeriodDrafts
// (customer + header-date-range scoped, for the manual flow), auto mode can
// legitimately produce several concurrently-active drafts for one customer
// covering DIFFERENT lots with staggered cycle windows — so the guard here
// is scoped per lot instead: does this specific deposit_line_id already have
// a non-cancelled draft line whose billing_period_start/end overlaps one of
// the newly generated cycle windows for that same lot?
export async function findOverlappingLotBillingLines(lotCycles = []) {
  if (!supabase) return missingSupabaseClientResult();
  if (!lotCycles.length) return { data: [], error: null };

  const depositLineIds = [...new Set(lotCycles.map((c) => c.depositLineId).filter(Boolean))];
  if (!depositLineIds.length) return { data: [], error: null };

  const result = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .select('deposit_line_id, billing_period_start, billing_period_end, tgd_billing_invoice_drafts!inner(draft_no, status)')
    .in('deposit_line_id', depositLineIds)
    .not('billing_period_start', 'is', null)
    .not('billing_period_end', 'is', null)
    .neq('tgd_billing_invoice_drafts.status', INVOICE_DRAFT_STATUS.CANCELLED);

  if (result.error) {
    return { data: null, error: normalizeServiceError(result.error) };
  }

  const existingByLot = new Map();
  for (const row of (result.data ?? [])) {
    const bucket = existingByLot.get(row.deposit_line_id) ?? [];
    bucket.push(row);
    existingByLot.set(row.deposit_line_id, bucket);
  }

  const conflicts = [];
  for (const cycle of lotCycles) {
    const existingForLot = existingByLot.get(cycle.depositLineId) ?? [];
    for (const existing of existingForLot) {
      const overlaps = existing.billing_period_start <= cycle.end && existing.billing_period_end >= cycle.start;
      if (overlaps) {
        conflicts.push({ ...cycle, conflictingDraftNo: existing.tgd_billing_invoice_drafts?.draft_no ?? null });
      }
    }
  }

  return { data: conflicts, error: null };
}

// Creates a storage invoice draft using auto per-lot cycle billing (see
// getAutoLotBillingPreview) instead of one staff-typed date range applied
// to every lot. Lots still needing a one-time cutoff seed are skipped (not
// billed) and reported back so the UI can prompt for them; this never
// silently bills a lot that hasn't been explicitly set up.
export async function createAutoLotBillingDraft({
  customerId,
  billThroughDate,
  note = null,
  internalReference = null,
  createdBy = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();
  if (!customerId || !billThroughDate) {
    return { data: null, error: validationError('customerId and billThroughDate are required.') };
  }

  const preview = await getAutoLotBillingPreview({ customerId, billThroughDate });
  if (preview.error) return { data: null, error: preview.error };

  const { lots, depositLines } = preview.data;
  const billableLots = lots.filter((lot) => !lot.needsSetup && lot.cycles.length > 0);
  const lotsNeedingSetup = lots.filter((lot) => lot.needsSetup);

  if (billableLots.length === 0) {
    return {
      data: null,
      error: validationError('No new storage cycles to bill for this customer/cutoff date.', { lotsNeedingSetup }),
    };
  }

  const lotCycles = billableLots.flatMap((lot) => lot.cycles.map((c) => ({
    depositLineId: lot.depositLineId, start: c.periodStart, end: c.periodEnd,
  })));

  const overlapResult = await findOverlappingLotBillingLines(lotCycles);
  if (overlapResult.error) return { data: null, error: overlapResult.error };

  if ((overlapResult.data ?? []).length > 0) {
    return {
      data: null,
      error: validationError('One or more lots already have an active draft covering an overlapping cycle window.', {
        conflicts: overlapResult.data,
      }),
    };
  }

  const depositLineById = new Map(depositLines.map((dl) => [dl.id, dl]));
  const lines = billableLots.flatMap((lot) => lot.cycles.map(
    (c) => buildInvoiceDraftLineFromStorageLine(c, depositLineById.get(lot.depositLineId) ?? {}),
  ));

  const totals = calculateInvoiceDraftTotals(lines);
  const periodStarts = lines.map((l) => l.billing_period_start).filter(Boolean).sort();
  const periodEnds = lines.map((l) => l.billing_period_end).filter(Boolean).sort();

  const customersResult = await getCustomers();
  const customerName = (customersResult.data ?? []).find((c) => c.id === customerId)?.customer_name ?? null;

  const draftNo = await resolveDraftNo();
  const header = {
    draft_no: draftNo,
    customer_id: customerId,
    customer_name: customerName,
    billing_period_start: periodStarts[0] ?? billThroughDate,
    billing_period_end: periodEnds[periodEnds.length - 1] ?? billThroughDate,
    status: INVOICE_DRAFT_STATUS.DRAFT,
    ...totals,
    currency: 'THB',
    note,
    internal_reference: internalReference,
    created_by: createdBy,
  };

  const headerInsert = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .insert(header)
    .select('*')
    .single();

  if (headerInsert.error) {
    return { data: null, error: normalizeServiceError(headerInsert.error) };
  }

  const draftId = headerInsert.data.id;
  const lineRows = lines.map((line) => ({ ...line, invoice_draft_id: draftId }));

  const linesInsert = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .insert(lineRows)
    .select('*');

  if (linesInsert.error) {
    return { data: null, error: normalizeServiceError(linesInsert.error) };
  }

  return {
    data: {
      draft: shapeBillingInvoiceDraftHeader(headerInsert.data),
      lines: (linesInsert.data ?? []).map(shapeBillingInvoiceDraftLine),
      lotsNeedingSetup,
    },
    error: null,
  };
}

export async function cancelBillingInvoiceDraft({
  draftId,
  reason = null,
  cancelledBy = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();
  if (!draftId) {
    return { data: null, error: validationError('Invoice draft id is required.') };
  }

  const existing = await getBillingInvoiceDraftById(draftId);
  if (existing.error) {
    return { data: null, error: existing.error };
  }

  if (!canCancelBillingInvoiceDraft(existing.data.draft)) {
    return {
      data: null,
      error: validationError('Only DRAFT or READY_TO_REVIEW invoice drafts can be cancelled.', {
        status: existing.data.draft.status,
      }),
    };
  }

  const now = new Date().toISOString();
  const headerUpdate = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .update({
      status: INVOICE_DRAFT_STATUS.CANCELLED,
      cancelled_at: now,
      cancelled_by: cancelledBy,
      cancel_reason: reason,
      updated_at: now,
    })
    .eq('id', draftId)
    .select('*')
    .single();

  if (headerUpdate.error) {
    return { data: null, error: normalizeServiceError(headerUpdate.error) };
  }

  const linesUpdate = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .update({ duplicate_guard_active: false })
    .eq('invoice_draft_id', draftId)
    .eq('duplicate_guard_active', true);

  if (linesUpdate.error) {
    return { data: null, error: normalizeServiceError(linesUpdate.error) };
  }

  return {
    data: shapeBillingInvoiceDraftHeader(headerUpdate.data),
    error: null,
  };
}

// Hard delete (not the soft CANCELLED status) — only ever called for plain
// DRAFT status. Lines are removed first (matching how create inserts lines
// then header) so the movements those lines pointed at immediately become
// selectable again in the billing movement weight report — there's no
// separate "used" flag anywhere else to reset, the partial unique index on
// tgd_billing_invoice_draft_lines is scoped by row existence.
export async function deleteBillingInvoiceDraft({ draftId } = {}) {
  if (!supabase) return missingSupabaseClientResult();
  if (!draftId) {
    return { data: null, error: validationError('Invoice draft id is required.') };
  }

  const existing = await getBillingInvoiceDraftById(draftId);
  if (existing.error) {
    return { data: null, error: existing.error };
  }

  if (!canDeleteBillingInvoiceDraft(existing.data.draft)) {
    return {
      data: null,
      error: validationError('Only DRAFT invoice drafts can be deleted.', {
        status: existing.data.draft.status,
      }),
    };
  }

  const linesDelete = await supabase
    .from(INVOICE_DRAFT_LINE_TABLE)
    .delete()
    .eq('invoice_draft_id', draftId);

  if (linesDelete.error) {
    return { data: null, error: normalizeServiceError(linesDelete.error) };
  }

  const headerDelete = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .delete()
    .eq('id', draftId);

  if (headerDelete.error) {
    return { data: null, error: normalizeServiceError(headerDelete.error) };
  }

  return { data: { draftId }, error: null };
}

export async function approveBillingInvoiceDraft({
  draftId,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();
  if (!draftId) {
    return { data: null, error: validationError('Invoice draft id is required.') };
  }

  const existing = await getBillingInvoiceDraftById(draftId);
  if (existing.error) {
    return { data: null, error: existing.error };
  }

  if (!canApproveBillingInvoiceDraft(existing.data.draft)) {
    return {
      data: null,
      error: validationError('Only DRAFT or READY_TO_REVIEW invoice drafts can be approved.', {
        status: existing.data.draft.status,
      }),
    };
  }

  const result = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .update({
      status: INVOICE_DRAFT_STATUS.APPROVED,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
    .in('status', APPROVABLE_INVOICE_DRAFT_STATUSES)
    .select('*')
    .single();

  if (result.error) {
    return { data: null, error: normalizeServiceError(result.error) };
  }

  return {
    data: shapeBillingInvoiceDraftHeader(result.data),
    error: null,
  };
}

export async function updateBillingInvoiceDraftMeta({
  draftId,
  note,
  internalReference,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();
  if (!draftId) {
    return { data: null, error: validationError('Invoice draft id is required.') };
  }

  const existing = await getBillingInvoiceDraftById(draftId);
  if (existing.error) {
    return { data: null, error: existing.error };
  }

  if (!CANCELLABLE_INVOICE_DRAFT_STATUSES.includes(existing.data.draft.status)) {
    return {
      data: null,
      error: validationError('Invoice draft metadata can only be updated for DRAFT or READY_TO_REVIEW.', {
        status: existing.data.draft.status,
      }),
    };
  }

  const patch = { updated_at: new Date().toISOString() };
  if (note !== undefined) patch.note = note;
  if (internalReference !== undefined) patch.internal_reference = internalReference;

  const result = await supabase
    .from(INVOICE_DRAFT_TABLE)
    .update(patch)
    .eq('id', draftId)
    .select('*')
    .single();

  if (result.error) {
    return { data: null, error: normalizeServiceError(result.error) };
  }

  return {
    data: shapeBillingInvoiceDraftHeader(result.data),
    error: null,
  };
}

export async function getBillingInvoiceDraftBplusExportReadiness(draftId) {
  if (!supabase) return missingSupabaseClientResult();
  if (!draftId) {
    return { data: null, error: validationError('Invoice draft id is required.') };
  }

  const existing = await getBillingInvoiceDraftById(draftId);
  if (existing.error) {
    return { data: null, error: existing.error };
  }

  let customer = null;
  const customerId = existing.data.draft.customer_id;
  if (customerId) {
    const customerResult = await supabase
      .from('tgd_customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (customerResult.error) {
      return { data: null, error: normalizeServiceError(customerResult.error) };
    }

    customer = normalizeCustomerForBplusReadiness(customerResult.data);
  }

  return {
    data: evaluateInvoiceDraftBplusExportReadiness({
      draft: existing.data.draft,
      lines: existing.data.lines,
      customer,
    }),
    error: null,
  };
}

export {
  calculateInvoiceDraftTotals,
  validateInvoiceDraftSourceRows,
  findDuplicateDraftLines,
} from '../utils/billingInvoiceDraftUtils.js';

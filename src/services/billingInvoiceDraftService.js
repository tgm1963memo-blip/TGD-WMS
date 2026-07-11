import { supabase } from './supabaseClient.js';
import {
  getBillingMovementWeightRows,
  shapeBillingMovementWeightRow,
} from './billingMovementWeightService.js';
import {
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
import { getBillingPeriodPreview } from './billingRateEngineService.js';
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

async function fetchMovementsByIds(movementIds = []) {
  const normalizedIds = [...new Set((movementIds ?? []).map((id) => String(id)).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return { data: [], error: null };
  }

  const result = await getBillingMovementWeightRows({ billableOnly: false });
  if (result.error) {
    return { data: null, error: result.error };
  }

  const rowsById = new Map(
    (result.data ?? []).map((row) => [String(row.movement_id), shapeBillingMovementWeightRow(row)]),
  );

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

  const draftNo = await resolveDraftNo();
  const payload = buildInvoiceDraftCreatePayload({
    draftNo,
    movements: movementResult.data,
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

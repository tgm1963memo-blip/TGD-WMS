/*
  Accounting Charge Handoff Review Service (Sprint 7D)
  Provides pure, in‑memory functions for creating a review draft, classifying rows,
  attaching temporary review notes, summarizing metrics, validating, grouping issues,
  marking rows as review‑only, and creating a snapshot for UI consumption.
  No network, DB, or file system interactions.
*/

/**
 * createAccountingChargeReviewDraft
 * Build the initial draft structure from a staging payload (canonical + Bplus draft).
 */
export function createAccountingChargeReviewDraft(stagingPayload) {
  // Expect stagingPayload to contain canonical_payload and bplus_draft_payload
  const { canonical_payload = {}, bplus_draft_payload = {} } = stagingPayload || {};
  return {
    canonical: { ...canonical_payload },
    bplusDraft: { ...bplus_draft_payload },
    reviewNotes: {}, // keyed by row id, populated later via attachAccountingReviewNotes
  };
}

/**
 * classifyAccountingChargeReviewRows
 * Add a `readiness_status` field to each Bplus draft row based on simple rules.
 */
export function classifyAccountingChargeReviewRows(draft) {
  if (!draft?.bplusDraft?.rows) return draft;
  const rows = draft.bplusDraft.rows.map((row, idx) => {
    const missingCustomer = !row.bplus_customer_code;
    const missingPeriod = !row.bplus_billing_period;
    const missingService = !row.bplus_service_code;
    const missingQty = Number(row.bplus_quantity ?? 0) <= 0;
    const missingWeight = Number(row.bplus_weight ?? 0) <= 0;
    const requiresReview = row.bplus_validation_status === 'NEEDS_REVIEW' || row.bplus_validation_status === 'INVALID';

    let status = 'READY';
    if (missingCustomer) status = 'MISSING_CUSTOMER_CODE';
    else if (missingPeriod) status = 'MISSING_BILLING_PERIOD';
    else if (missingService) status = 'MISSING_SERVICE_CODE';
    else if (missingQty || missingWeight) status = 'MISSING_QUANTITY_WEIGHT';
    else if (requiresReview) status = 'REQUIRES_REVIEW';

    return { ...row, readiness_status: status, __rowIndex: idx };
  });
  return { ...draft, bplusDraft: { ...draft.bplusDraft, rows } };
}

/**
 * attachAccountingReviewNotes
 * Merge a notes map (rowIndex -> note string) into the draft rows.
 */
export function attachAccountingReviewNotes(draft, notesMap = {}) {
  if (!draft?.bplusDraft?.rows) return draft;
  const rows = draft.bplusDraft.rows.map((row) => {
    const idx = row.__rowIndex;
    const note = notesMap[idx] || '';
    return { ...row, review_note: note };
  });
  return { ...draft, bplusDraft: { ...draft.bplusDraft, rows } };
}

/**
 * summarizeAccountingChargeReviewDraft
 * Produce aggregated metrics for UI summary cards.
 */
export function summarizeAccountingChargeReviewDraft(draft) {
  const rows = draft?.bplusDraft?.rows || [];
  const total = rows.length;
  let ready = 0;
  let blocked = 0;
  let warning = 0;
  let info = 0;
  rows.forEach((r) => {
    switch (r.readiness_status) {
      case 'READY':
        ready++; break;
      case 'REQUIRES_REVIEW':
      case 'MISSING_QUANTITY_WEIGHT':
        warning++;
        break;
      case 'MISSING_CUSTOMER_CODE':
      case 'MISSING_BILLING_PERIOD':
      case 'MISSING_SERVICE_CODE':
        blocked++;
        break;
      default:
        info++;
    }
  });
  return { total, ready, blocked, warning, info };
}

/**
 * validateAccountingChargeReviewDraft
 * Run validation logic (pure, synchronous) and attach warnings to each row.
 * For this sprint we simply forward warnings from the staging payload.
 */
export function validateAccountingChargeReviewDraft(draft) {
  const warnings = [];
  if (!draft?.bplusDraft?.rows) return { ...draft, validation_warnings: warnings };
  draft.bplusDraft.rows.forEach((row, idx) => {
    if (!row.bplus_customer_code) warnings.push(`Row ${idx + 1}: Missing customer code`);
    if (!row.bplus_billing_period) warnings.push(`Row ${idx + 1}: Missing billing period`);
    if (!row.bplus_service_code) warnings.push(`Row ${idx + 1}: Missing service code`);
    if (Number(row.bplus_quantity ?? 0) <= 0) warnings.push(`Row ${idx + 1}: Missing or zero quantity`);
    if (Number(row.bplus_weight ?? 0) <= 0) warnings.push(`Row ${idx + 1}: Missing or zero weight`);
    if (row.bplus_validation_status === 'NEEDS_REVIEW') warnings.push(`Row ${idx + 1}: Requires review`);
  });
  return { ...draft, validation_warnings: warnings };
}

/**
 * groupReviewDraftIssues
 * Group warnings by severity: BLOCKED, WARNING, INFO, READY.
 */
export function groupReviewDraftIssues(warnings = []) {
  const groups = { BLOCKED: [], WARNING: [], INFO: [], READY: [] };
  warnings.forEach((msg) => {
    if (/Missing|Invalid/.test(msg)) groups.BLOCKED.push(msg);
    else if (/Requires review|Zero/.test(msg)) groups.WARNING.push(msg);
    else groups.INFO.push(msg);
  });
  // If no warnings, consider everything READY (used by UI when no issues).
  if (warnings.length === 0) groups.READY.push('All rows ready for review');
  return groups;
}

/**
 * markRowsForReviewOnly
 * Tag each row with a flag preventing any future mutation pathways.
 */
export function markRowsForReviewOnly(draft) {
  if (!draft?.bplusDraft?.rows) return draft;
  const rows = draft.bplusDraft.rows.map((row) => ({ ...row, reviewOnly: true }));
  return { ...draft, bplusDraft: { ...draft.bplusDraft, rows } };
}

/**
 * createReviewOnlyHandoffSnapshot
 * Produce a snapshot object consumed by the UI – immutable representation.
 */
export function createReviewOnlyHandoffSnapshot(draft) {
  // Deep copy to guarantee immutability (pure function).
  const snapshot = JSON.parse(JSON.stringify(draft));
  return snapshot;
}

/**
 * Internal helpers (non‑exported) – optional aliases for previous sprint code.
 */
function prepareReviewData(stagingPayload) {
  return createAccountingChargeReviewDraft(stagingPayload);
}
function aggregateMetrics(draft) {
  return summarizeAccountingChargeReviewDraft(draft);
}
function classifyRowReadiness(row) {
  // Not used directly; provided for compatibility.
  return row.readiness_status;
}
function groupWarnings(warnings) {
  return groupReviewDraftIssues(warnings);
}

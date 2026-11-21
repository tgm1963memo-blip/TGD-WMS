// The Movement Ledger's row set: three sources merged and de-duplicated.
// Lives outside the report page so the billing statement export
// (billingStatementExportService.js) attaches exactly the rows that page
// shows, instead of a second copy of this merge drifting from it.
import {
  getMovementLedgerRows,
  getConfirmedDepositReceiptRows,
  getConfirmedWithdrawalRows,
} from './movementLedgerReportService.js';

// Inbound receipts from confirmed deposit lines (authoritative source with correct lot_no)
// Outbound movements from stock_movements (DISPATCH, DELIVERY, etc.)
const INBOUND_SKIP = new Set(['RECEIVE', 'RECEIVE_CONFIRM', 'RECEIVE_PENDING', 'INBOUND', 'RETURN', 'ADJUSTMENT_IN']);

// Fetches and merges the three movement sources for a given date range,
// applying the same product/location filters used on screen. Shared by both
// the main (on-screen) fetch and the prior-period fetch used to compute each
// lot's ยกมา (brought-forward) opening balance for the Excel export.
export async function fetchMergedMovementLedgerRows(serviceFilters, filterCriteria) {
  const [result, depositResult, withdrawalResult] = await Promise.all([
    getMovementLedgerRows(serviceFilters),
    getConfirmedDepositReceiptRows(serviceFilters),
    getConfirmedWithdrawalRows(serviceFilters),
  ]);

  // Keep outbound/neutral movements; exclude draft.
  // Exclude movements generated from deposits/withdrawals because depositRows/withdrawalRows cover them.
  let outboundRows = (result.data ?? []).filter((r) => {
    const movType = String(r.movement_type_raw || '').toUpperCase();
    if (movType.includes('DRAFT')) return false;
    // tgd_stock_movements actually stores 'CUSTOMER_DEPOSIT_REQUEST' (confirmed via direct
    // query), not the bare 'CUSTOMER_DEPOSIT' this used to check for — that exact-match
    // never fired, so every deposit confirmation was double counted here: once from this
    // generic stock_movements row (blank lot_no, raw movement-id reference) and once from
    // the richer, lot_no-bearing row depositRows already supplies for the same event.
    // startsWith so any other 'CUSTOMER_DEPOSIT*' source_module variant is caught too.
    if (String(r.source_module || '').startsWith('CUSTOMER_DEPOSIT')) return false;

    // Fallback for legacy records that might not have source_module populated:
    // If it's an inbound movement but has no source_module, we assume it's a legacy deposit
    // and skip it to prevent double-counting.
    if (!r.source_module && INBOUND_SKIP.has(movType)) return false;

    return true;
  });

  let depositRows = depositResult.data ?? [];
  let withdrawalRows = withdrawalResult.data ?? [];

  // Apply movement type filter
  if (filterCriteria.movementType && filterCriteria.movementType.length > 0) {
    const types = Array.isArray(filterCriteria.movementType) ? filterCriteria.movementType : [filterCriteria.movementType];
    const matchType = (r) => types.includes(r.movement_type_canonical) || types.includes(r.movement_type_raw) || types.includes(r.movement_type);
    outboundRows = outboundRows.filter(matchType);
    depositRows = depositRows.filter(matchType);
    withdrawalRows = withdrawalRows.filter(matchType);
  }

  // Apply product filter
  if (filterCriteria.productId && filterCriteria.productId.length > 0) {
    const applyProd = (rowSet) => Array.isArray(filterCriteria.productId)
      ? rowSet.filter((r) => filterCriteria.productId.includes(r.product_id))
      : rowSet.filter((r) => r.product_id === filterCriteria.productId);
    outboundRows = applyProd(outboundRows);
    depositRows = applyProd(depositRows);
    withdrawalRows = applyProd(withdrawalRows);
  }

  // Apply location filter
  if (filterCriteria.locationId && filterCriteria.locationId.length > 0) {
    if (Array.isArray(filterCriteria.locationId)) {
      outboundRows = outboundRows.filter((r) =>
        filterCriteria.locationId.includes(r.location_id) ||
        filterCriteria.locationId.includes(r.to_location_id) ||
        filterCriteria.locationId.includes(r.from_location_id));
    } else {
      outboundRows = outboundRows.filter((r) =>
        r.location_id === filterCriteria.locationId ||
        r.to_location_id === filterCriteria.locationId ||
        r.from_location_id === filterCriteria.locationId);
    }
  }

  // Deduplicate withdrawals
  // outboundRows contains DISPATCH from tgd_stock_movements (basic fields)
  // withdrawalRows contains CUSTOMER_WITHDRAWAL from tgd_customer_withdrawal_requests (rich fields, e.g. tracking_code)
  // Due to DB query limits (1000 rows max) on requests, older withdrawals might be missing in withdrawalRows
  // but present in outboundRows. We use withdrawalRows to enrich, and fallback to outboundRows.
  const withdrawalDocNumbers = new Set(withdrawalRows.map((r) => String(r.source_document_no)));
  outboundRows = outboundRows.filter((r) => {
    const isWithdrawal = r.movement_type_raw === 'CUSTOMER_WITHDRAWAL' || (r.movement_type_raw === 'DISPATCH' && String(r.source_document_no).startsWith('WD-'));
    if (isWithdrawal) {
      if (withdrawalDocNumbers.has(String(r.source_document_no))) {
        // We have a richer version in withdrawalRows (all lines for this WD were fetched), so drop this basic one from outboundRows
        return false;
      }
    }
    return true;
  });

  // Merge and sort by movement_date ascending; same date: inbound before outbound
  const rows = [...depositRows, ...withdrawalRows, ...outboundRows].sort((a, b) => {
    const aTime = new Date(a.movement_date ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.movement_date ?? b.created_at ?? 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    const aOut = (a.movement_type === 'DISPATCH' || a.movement_type_canonical === 'DISPATCH') ? 1 : 0;
    const bOut = (b.movement_type === 'DISPATCH' || b.movement_type_canonical === 'DISPATCH') ? 1 : 0;
    return aOut - bOut;
  });

  // A failure in the deposit or withdrawal source (e.g. a DB query error)
  // used to be silently dropped here — only the stock_movements source's
  // error ever reached the screen, so a broken deposit/withdrawal query
  // just rendered as "no data" with no indication anything had failed.
  const error = result.error ?? depositResult.error ?? withdrawalResult.error ?? null;

  return { rows, error };
}

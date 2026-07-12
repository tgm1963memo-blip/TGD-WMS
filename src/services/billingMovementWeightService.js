import { supabase } from './supabaseClient.js';

import { getUnifiedMovementRows } from './unifiedMovementReadService.js';

import { applyBillingMovementWeightFilters } from '../utils/billingMovementWeightReportUtils.js';
import { resolveMovementWeights } from '../utils/billingWeightUtils.js';



export const BILLING_MOVEMENT_WEIGHT_VIEW_NAME = 'tgd_billing_movement_weight_v';



function missingSupabaseClientResult() {

  return {

    data: null,

    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),

  };

}



export function shapeBillingMovementWeightRow(row = {}) {

  return {

    movement_id: row.movement_id ?? row.id ?? null,

    movement_type: row.movement_type_raw ?? row.movement_type ?? null,

    canonical_movement_type: row.canonical_movement_type ?? row.movement_type_canonical ?? null,

    movement_date: row.movement_date ?? row.created_at ?? null,

    customer_id: row.customer_id ?? null,

    customer_code: row.customer_code ?? null,

    customer_name: row.customer_name ?? null,

    product_id: row.product_id ?? null,

    product_code: row.product_code ?? null,

    product_name: row.product_name ?? null,

    temperature_type: row.temperature_type ?? null,

    lot_id: row.lot_id ?? null,

    lot_no: row.lot_no ?? null,

    pallet_id: row.to_pallet_id ?? row.from_pallet_id ?? row.pallet_id ?? null,

    pallet_no: row.pallet_no ?? null,

    warehouse_id: row.to_warehouse_id ?? row.from_warehouse_id ?? row.warehouse_id ?? null,

    from_location_id: row.from_location_id ?? null,

    to_location_id: row.to_location_id ?? null,

    qty: row.qty ?? row.quantity ?? 0,

    uom: row.uom ?? null,

    net_weight: row.net_weight ?? 0,

    gross_weight: row.gross_weight ?? 0,

    chargeable_weight: row.chargeable_weight ?? 0,

    weight_per_unit: row.weight_per_unit ?? null,

    pallet_weight: row.pallet_weight ?? null,

    source_document_no: row.source_document_no ?? row.reference_no ?? null,

    source_document_type: row.source_document_type ?? row.source_module ?? row.reference_type ?? null,

    source_document_id: row.source_document_id ?? row.reference_id ?? null,

    is_draft: Boolean(row.is_draft),

    is_billable: Boolean(row.is_billable),

    billing_exclusion_reason: row.billing_exclusion_reason ?? null,

    billing_service_type: row.billing_service_type ?? null,

    billing_status: row.billing_status ?? null,

    ledger_source: row.ledger_source ?? null,

  };

}

// Rows sourced from the customer deposit/withdrawal request tables (via
// getConfirmedDepositReceiptRows / getConfirmedWithdrawalRows /
// getStorageOpeningBalanceRows — see movementLedgerReportService.js) only
// ever carry a plain `weight` field and no billing classification at all,
// unlike tgd_billing_movement_weight_v / tgd_unified_movements_v rows,
// which already have net_weight/gross_weight/chargeable_weight and
// is_billable/billing_status computed as real columns. shapeBillingMovementWeightRow
// alone left those fields at 0/false/null for this source, which both hid
// the weight in the report table and made every row fail the "is this
// selectable for an invoice draft" check (getMovementDraftSelectionState).
//
// This report merges rows from BOTH sources in one list, so the fallback
// below only applies when a field is genuinely absent (`== null`) — an
// already-classified tgd_unified_movements_v row (e.g. an ADJUST_IN/
// ADJUST_OUT movement resolveBillingEligibility deliberately excludes)
// must keep its real is_billable:false, not get silently overridden to
// true. resolveMovementWeights itself already prefers an explicit
// gross_weight/net_weight/chargeable_weight/billing_status when present
// (falling back to `weight` and a from-scratch computation only when
// they're missing), so it's safe to apply unconditionally to both sources.
export function enrichClientMergedBillingMovementWeightRow(row = {}) {

  const shaped = shapeBillingMovementWeightRow(row);
  const weights = resolveMovementWeights(row);
  const rawType = String(row.movement_type_raw ?? row.movement_type ?? '').toUpperCase();
  const isStorageOpening = rawType === 'STORAGE_OPENING_BALANCE';
  const isOutbound = rawType.includes('WITHDRAWAL') || rawType.includes('DISPATCH');

  return {
    ...shaped,
    net_weight: weights.net_weight,
    gross_weight: weights.gross_weight,
    chargeable_weight: weights.chargeable_weight,
    weight_per_unit: weights.weight_per_unit,
    pallet_weight: weights.pallet_weight,
    is_billable: row.is_billable != null ? Boolean(row.is_billable) : true,
    billing_exclusion_reason: row.billing_exclusion_reason ?? null,
    billing_service_type: row.billing_service_type
      ?? (isStorageOpening ? 'STORAGE' : (isOutbound ? 'OUTBOUND_HANDLING' : 'INBOUND_HANDLING')),
    billing_status: weights.billing_status,
  };

}


async function readFromBillingDatabaseView(filters = {}) {

  if (!supabase) return { data: null, error: null, usedView: false };

  let query = supabase

    .from(BILLING_MOVEMENT_WEIGHT_VIEW_NAME)

    .select('*')

    .order('movement_date', { ascending: false });



  if (filters.customerId) query = query.eq('customer_id', filters.customerId);

  if (filters.productId) query = query.eq('product_id', filters.productId);

  if (filters.dateFrom) query = query.gte('movement_date', filters.dateFrom);

  if (filters.dateTo) query = query.lte('movement_date', filters.dateTo + 'T23:59:59.999Z');



  const result = await query;

  if (result.error) {

    return { data: null, error: result.error, usedView: false };

  }



  return { data: result.data ?? [], error: null, usedView: true };

}



export async function getBillingMovementWeightRows(filters = {}) {

  if (!supabase) return missingSupabaseClientResult();



  const viewResult = await readFromBillingDatabaseView(filters);

  if (viewResult.usedView && !viewResult.error) {

    const rows = applyBillingMovementWeightFilters(

      (viewResult.data ?? []).map(shapeBillingMovementWeightRow),

      filters,

    );



    return {

      data: rows,

      error: null,

      source: 'billing_database_view',

    };

  }



  const result = await getUnifiedMovementRows({

    ...filters,

    excludeDraft: true,

  });



  if (result.error) {

    return { data: null, error: viewResult.error ?? result.error, source: result.source ?? 'client_merge' };

  }



  const rows = applyBillingMovementWeightFilters(

    (result.data ?? []).map(shapeBillingMovementWeightRow),

    filters,

  );



  if (filters.billableOnly) {

    return {

      data: rows.filter((row) => row.is_billable),

      error: null,

      source: result.source ?? 'client_merge',

    };

  }



  return {

    data: rows,

    error: null,

    source: result.source ?? 'client_merge',

  };

}



export async function getBillableMovementWeightRows(filters = {}) {

  return getBillingMovementWeightRows({

    ...filters,

    billableOnly: true,

  });

}


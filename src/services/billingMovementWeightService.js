import { supabase } from './supabaseClient.js';

import { getUnifiedMovementRows } from './unifiedMovementReadService.js';

import { applyBillingMovementWeightFilters } from '../utils/billingMovementWeightReportUtils.js';



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



async function readFromBillingDatabaseView(filters = {}) {

  if (!supabase) return { data: null, error: null, usedView: false };



  console.log('Fetching billing movement weight rows with filters', filters);
  let query = supabase

    .from(BILLING_MOVEMENT_WEIGHT_VIEW_NAME)

    .select('*')

    .order('movement_date', { ascending: false });



  if (filters.customerId) query = query.eq('customer_id', filters.customerId);

  if (filters.productId) query = query.eq('product_id', filters.productId);

  if (filters.dateFrom) query = query.gte('movement_date', filters.dateFrom);

  if (filters.dateTo) query = query.lte('movement_date', filters.dateTo + 'T23:59:59.999Z');



  const result = await query;
  console.log('Billing movement weight query result', result);

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


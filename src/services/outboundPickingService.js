import { supabase } from './supabaseClient.js';

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}

function requireValue(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required.`);
  }
}

function requirePositiveNumber(value, fieldName) {
  requireValue(value, fieldName);

  if (Number(value) <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
}

function requireNonnegativeNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (Number(value) < 0) {
    throw new Error(`${fieldName} must be zero or greater.`);
  }
}

async function callRpc(name, params) {
  requireSupabaseClient();

  const { data, error } = await supabase.rpc(name, params);

  if (error) {
    throw error;
  }

  return data;
}

export async function createOutboundDraft(payload = {}) {
  requireValue(payload.document_no, 'document_no');

  return callRpc('tgd_rpc_create_outbound_draft', {
    p_document_no: payload.document_no,
    p_customer_id: payload.customer_id ?? null,
    p_source_module: payload.source_module ?? null,
    p_source_document_id: payload.source_document_id ?? null,
    p_source_document_no: payload.source_document_no ?? null,
    p_requested_ship_date: payload.requested_ship_date ?? null,
  });
}

export async function addOutboundLine(payload = {}) {
  requireValue(payload.document_id, 'document_id');
  requireValue(payload.product_id, 'product_id');
  requirePositiveNumber(payload.requested_quantity, 'requested_quantity');
  requireNonnegativeNumber(payload.requested_weight, 'requested_weight');

  return callRpc('tgd_rpc_add_outbound_line', {
    p_document_id: payload.document_id,
    p_product_id: payload.product_id,
    p_requested_quantity: payload.requested_quantity,
    p_lot_id: payload.lot_id ?? null,
    p_requested_weight: payload.requested_weight ?? 0,
  });
}

export async function reserveOutboundStock(payload = {}) {
  requireValue(payload.outbound_document_id, 'outbound_document_id');
  requireValue(payload.outbound_line_id, 'outbound_line_id');
  requireValue(payload.location_id, 'location_id');
  requirePositiveNumber(payload.reserved_quantity, 'reserved_quantity');
  requireNonnegativeNumber(payload.reserved_weight, 'reserved_weight');

  return callRpc('tgd_rpc_reserve_outbound_stock', {
    p_outbound_document_id: payload.outbound_document_id,
    p_outbound_line_id: payload.outbound_line_id,
    p_location_id: payload.location_id,
    p_reserved_quantity: payload.reserved_quantity,
    p_reserved_weight: payload.reserved_weight ?? 0,
  });
}

export async function releaseOutboundReservation(payload = {}) {
  requireValue(payload.reservation_id, 'reservation_id');

  return callRpc('tgd_rpc_release_outbound_reservation', {
    p_reservation_id: payload.reservation_id,
  });
}

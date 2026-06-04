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

async function runSelect(query) {
  requireSupabaseClient();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

export async function listOutboundDocuments() {
  return runSelect(
    supabase
      .from('tgd_outbound_documents')
      .select('id, document_no, status, customer_id, source_module, source_document_id, source_document_no, requested_ship_date, created_at, updated_at')
      .order('created_at', { ascending: false }),
  );
}

export async function getOutboundDocumentDetail(documentId) {
  requireValue(documentId, 'documentId');

  const document = await runSelect(
    supabase
      .from('tgd_outbound_documents')
      .select('id, document_no, status, customer_id, source_module, source_document_id, source_document_no, requested_ship_date, created_at, updated_at')
      .eq('id', documentId)
      .single(),
  );

  const lines = await runSelect(
    supabase
      .from('tgd_outbound_lines')
      .select('id, document_id, product_id, lot_id, requested_quantity, requested_weight, picked_quantity, picked_weight, status, created_at, updated_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true }),
  );

  const reservations = await runSelect(
    supabase
      .from('tgd_outbound_reservations')
      .select('id, outbound_document_id, outbound_line_id, customer_id, product_id, lot_id, location_id, reserved_quantity, reserved_weight, status, released_at, created_at, updated_at')
      .eq('outbound_document_id', documentId)
      .order('created_at', { ascending: true }),
  );

  return {
    document,
    lines: lines ?? [],
    reservations: reservations ?? [],
  };
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

export async function confirmOutboundPickDraft(payload = {}) {
  const outboundDocumentId = payload.outboundDocumentId ?? payload.outbound_document_id;
  const outboundLineId = payload.outboundLineId ?? payload.outbound_line_id;
  const reservationId = payload.reservationId ?? payload.reservation_id;
  const pickedQuantity = payload.pickedQuantity ?? payload.picked_quantity;
  const pickedWeight = payload.pickedWeight ?? payload.picked_weight;
  const pickReference = payload.pickReference ?? payload.pick_reference;

  requireValue(outboundDocumentId, 'outbound_document_id');
  requireValue(outboundLineId, 'outbound_line_id');
  requireValue(reservationId, 'reservation_id');
  requirePositiveNumber(pickedQuantity, 'picked_quantity');
  requireNonnegativeNumber(pickedWeight, 'picked_weight');

  return callRpc('tgd_rpc_confirm_outbound_pick_draft', {
    p_outbound_document_id: outboundDocumentId,
    p_outbound_line_id: outboundLineId,
    p_reservation_id: reservationId,
    p_picked_quantity: pickedQuantity,
    p_picked_weight: pickedWeight ?? 0,
    p_pick_reference: pickReference ?? null,
    p_note: payload.note ?? null,
  });
}

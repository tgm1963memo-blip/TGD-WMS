import { supabase } from './supabaseClient.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableNumber,
  toNullableText,
} from './customerPortalServiceUtils.js';

const FACILITY_USAGE_SELECT = [
  'id',
  'request_no',
  'customer_id',
  'status',
  'requested_usage_date',
  'usage_type',
  'duration_hours',
  'contact_name',
  'contact_phone',
  'note',
  'service_rate_id',
  'service_rate_amount',
  'service_rate_unit_basis',
  'submitted_at',
  'created_at',
].join(', ');

export async function listCustomerFacilityUsageRequests(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  let query = supabase
    .from('tgd_customer_facility_usage_requests')
    .select(FACILITY_USAGE_SELECT)
    .order('created_at', { ascending: false });

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.status) query = query.eq('status', filters.status);

  return query;
}

export async function createCustomerFacilityUsageRequest(payload = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_create_customer_facility_usage_request', {
    p_requested_usage_date: payload.requestedUsageDate ?? null,
    p_duration_hours: toNullableNumber(payload.durationHours),
    p_contact_name: toNullableText(payload.contactName),
    p_contact_phone: toNullableText(payload.contactPhone),
    p_note: toNullableText(payload.note),
    p_customer_id: payload.customerId ?? null,
    p_service_rate_id: payload.serviceRateId ?? null,
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function submitCustomerFacilityUsageRequest(requestId) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_submit_customer_facility_usage_request', {
    p_request_id: requestId,
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

export async function listCustomerStorageRateRules(customerId) {
  if (!supabase) return missingSupabaseClientResult();

  return supabase
    .from('tgd_customer_storage_rate_rules')
    .select('id, customer_id, charge_basis, temperature_type, rate, currency, is_active, note, created_at, updated_at')
    .eq('customer_id', customerId)
    .order('charge_basis', { ascending: true });
}

export async function upsertCustomerStorageRateRule(payload = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_upsert_customer_storage_rate_rule', {
    p_rule_id: payload.ruleId ?? null,
    p_customer_id: payload.customerId ?? null,
    p_charge_basis: toNullableText(payload.chargeBasis),
    p_rate: toNullableNumber(payload.rate),
    p_currency: toNullableText(payload.currency) ?? 'THB',
    p_note: toNullableText(payload.note),
    p_is_active: typeof payload.isActive === 'boolean' ? payload.isActive : true,
    p_temperature_type: toNullableText(payload.temperatureType) ?? 'FROZEN',
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

import { supabase } from './supabaseClient.js';
import { missingSupabaseClientResult, normalizeCustomerPortalRpcData } from './customerPortalServiceUtils.js';
import { DEFAULT_CUSTOMER_REQUEST_POLICY } from '../utils/customerRequestCancelUtils.js';

export async function getCustomerRequestPolicy() {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_get_customer_request_policy');
  if (error) return { data: null, error };

  const normalized = normalizeCustomerPortalRpcData(data) ?? {};
  return {
    data: {
      deposit_cancel_lead_days: normalized.deposit_cancel_lead_days ?? DEFAULT_CUSTOMER_REQUEST_POLICY.deposit_cancel_lead_days,
      withdrawal_cancel_lead_days: normalized.withdrawal_cancel_lead_days ?? DEFAULT_CUSTOMER_REQUEST_POLICY.withdrawal_cancel_lead_days,
      updated_at: normalized.updated_at ?? null,
    },
    error: null,
  };
}

export async function updateCustomerRequestPolicy({
  depositCancelLeadDays,
  withdrawalCancelLeadDays,
}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_update_customer_request_policy', {
    p_deposit_cancel_lead_days: depositCancelLeadDays,
    p_withdrawal_cancel_lead_days: withdrawalCancelLeadDays,
  });

  return { data: normalizeCustomerPortalRpcData(data), error };
}

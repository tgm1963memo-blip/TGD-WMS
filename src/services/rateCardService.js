import {
  BILLING_BASIS_TYPES,
  OPERATION_CHARGE_TYPES,
  STORAGE_CHARGE_BASIS,
} from '../constants/coldStorageBilling.js';
import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getCustomerRateCards(filters = {}) {
  if (!supabase) return missingSupabaseClientResult();

  let query = supabase
    .from('tgd_customers')
    .select('id, customer_code, customer_name, is_active, created_at')
    .order('customer_name', { ascending: true });

  if (filters.customerId) query = query.eq('id', filters.customerId);
  if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);

  return query;
}

export async function getRateCardByCustomer(customerId) {
  return getCustomerRateCards({ customerId });
}

export function getDefaultStorageRateRules() {
  return [
    {
      rate_key: 'DEFAULT_STORAGE_WEIGHT',
      basis_type: BILLING_BASIS_TYPES.MONTHLY_AVERAGE_WEIGHT,
      storage_charge_basis: STORAGE_CHARGE_BASIS.CHARGEABLE_WEIGHT,
      rate: 0,
      currency: 'THB',
    },
  ];
}

export function getDefaultOperationRateRules() {
  return Object.values(OPERATION_CHARGE_TYPES).map((chargeType) => ({
    rate_key: `DEFAULT_${chargeType}`,
    charge_type: chargeType,
    basis_type: BILLING_BASIS_TYPES.OPERATION_QUANTITY,
    rate: 0,
    currency: 'THB',
  }));
}

export function resolveRateForPreview(context = {}, rateCards = []) {
  const matchingRate = rateCards.find((rateCard) => {
    const customerMatches = !rateCard.customer_id || rateCard.customer_id === context.customer_id;
    const chargeMatches = !rateCard.charge_type || rateCard.charge_type === context.charge_type;
    const basisMatches = !rateCard.basis_type || rateCard.basis_type === context.basis_type;

    return customerMatches && chargeMatches && basisMatches;
  });

  if (matchingRate) {
    return {
      rate: Number(matchingRate.rate ?? 0),
      currency: matchingRate.currency ?? 'THB',
      rate_key: matchingRate.rate_key ?? matchingRate.id,
    };
  }

  return {
    rate: Number(context.defaultRate ?? 0),
    currency: context.currency ?? 'THB',
    rate_key: 'PREVIEW_DEFAULT',
  };
}

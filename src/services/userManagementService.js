import { supabase } from './supabaseClient.js';
import { getUserProfiles } from './userProfileService.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableText,
} from './customerPortalServiceUtils.js';

export const INTERNAL_ROLES = Object.freeze([
  'admin',
  'warehouse_manager',
  'warehouse_admin',
  'warehouse_staff',
  'accounting',
  'viewer',
]);

export const CUSTOMER_PORTAL_ROLES = Object.freeze(['customer_admin', 'customer_user']);

export const ALL_ASSIGNABLE_ROLES = Object.freeze([...INTERNAL_ROLES, ...CUSTOMER_PORTAL_ROLES]);

export { getUserProfiles };

export async function createAuthUser({ email, password }) {
  if (!supabase) return missingSupabaseClientResult();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { data: null, error: sessionError };

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    return { data: null, error: new Error('Active login session required') };
  }

  const response = await fetch('/api/admin-create-auth-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { data: null, error: new Error(payload.error || 'Unable to create auth user') };
  }

  return { data: payload, error: null };
}

export async function upsertUserProfile(payload = {}) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_admin_upsert_user_profile', {
    p_profile_id: payload.profileId ?? null,
    p_email: toNullableText(payload.email),
    p_display_name: toNullableText(payload.displayName),
    p_role: toNullableText(payload.role),
    p_customer_id: payload.customerId ?? null,
    p_auth_user_id: payload.authUserId ?? null,
    p_is_active: typeof payload.isActive === 'boolean' ? payload.isActive : true,
  });

  if (error) return { data: null, error };
  return { data: normalizeCustomerPortalRpcData(data), error: null };
}

export async function setUserProfileActive(profileId, isActive) {
  if (!supabase) return missingSupabaseClientResult();

  const { data, error } = await supabase.rpc('tgd_admin_set_user_profile_active', {
    p_profile_id: profileId,
    p_is_active: isActive,
  });

  if (error) return { data: null, error };
  return { data: normalizeCustomerPortalRpcData(data), error: null };
}

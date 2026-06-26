import { supabase } from './supabaseClient.js';
import { getUserProfiles } from './userProfileService.js';
import {
  missingSupabaseClientResult,
  normalizeCustomerPortalRpcData,
  toNullableText,
} from './customerPortalServiceUtils.js';

/**
 * Strip invisible / zero-width Unicode characters that break HTTP headers.
 * BOM (U+FEFF), zero-width space, joiners, soft-hyphen, word-joiner, etc.
 */
const HIDDEN_CODE_POINTS = new Set([
  0xfeff, 0x200b, 0x200c, 0x200d, 0x00ad, 0x2060, 0xfffe,
]);

function stripHiddenChars(value) {
  if (!value) return '';
  return String(value)
    .split('')
    .filter((ch) => !HIDDEN_CODE_POINTS.has(ch.charCodeAt(0)))
    .join('')
    .trim();
}

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

  const rawToken = sessionData?.session?.access_token;
  if (!rawToken) {
    return { data: null, error: new Error('Active login session required') };
  }

  // Sanitize: strip hidden Unicode chars (BOM, zero-width, etc.) that cause
  // "Cannot convert argument to a ByteString" when placed in HTTP headers.
  const accessToken = stripHiddenChars(rawToken);
  const cleanEmail = stripHiddenChars(email);
  const cleanPassword = String(password || '')
    .split('')
    .filter((ch) => !HIDDEN_CODE_POINTS.has(ch.charCodeAt(0)))
    .join('');

  const response = await fetch('/api/admin-create-auth-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
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
    p_pin_code: payload.pinCode ?? null,
  });

  if (error) return { data: null, error };
  return { data: normalizeCustomerPortalRpcData(data), error: null };
}

export async function resetUserPassword(email, newPassword) {
  if (!supabase) return missingSupabaseClientResult();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { data: null, error: sessionError };

  const rawToken = sessionData?.session?.access_token;
  if (!rawToken) return { data: null, error: new Error('Active login session required') };

  const accessToken = stripHiddenChars(rawToken);

  const response = await fetch('/api/admin-create-auth-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: stripHiddenChars(email), password: String(newPassword || '') }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { data: null, error: new Error(payload.error || 'Unable to reset password') };
  return { data: payload, error: null };
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

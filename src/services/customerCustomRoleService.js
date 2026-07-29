import { supabase } from './supabaseClient.js';

function missing() {
  return { data: null, error: new Error('Supabase client not configured.') };
}

// Single-role lookup used by UserRoleProvider to resolve a customer_user's
// effective allowed_menu_keys — relies on tgd_customer_custom_roles' own
// customer-scoped RLS read policy (the caller can only ever be assigned a
// role belonging to their own company, so no extra customer_id filter is
// needed here).
export async function getCustomerCustomRole(roleId) {
  if (!supabase || !roleId) return { data: null, error: null };
  return supabase
    .from('tgd_customer_custom_roles')
    .select('id, role_name, allowed_menu_keys, is_active')
    .eq('id', roleId)
    .maybeSingle();
}

export async function listCustomerCustomRoles(customerId) {
  if (!supabase) return missing();
  return supabase
    .from('tgd_customer_custom_roles')
    .select('id, role_name, allowed_menu_keys, is_active, created_at')
    .eq('customer_id', customerId)
    .order('role_name');
}

export async function upsertCustomerCustomRole(payload = {}) {
  if (!supabase) return missing();
  const { data, error } = await supabase.rpc('tgd_upsert_customer_custom_role', {
    p_role_id: payload.roleId ?? null,
    p_role_name: payload.roleName,
    p_allowed_menu_keys: payload.allowedMenuKeys ?? [],
    p_is_active: payload.isActive ?? true,
  });
  return { data, error };
}

export async function deleteCustomerCustomRole(roleId) {
  if (!supabase) return missing();
  const { data, error } = await supabase.rpc('tgd_delete_customer_custom_role', {
    p_role_id: roleId,
  });
  return { data, error };
}

export async function listCustomerTeamUsers() {
  if (!supabase) return missing();
  return supabase.rpc('tgd_list_customer_team_users');
}

export async function assignCustomerUserCustomRole(userProfileId, customRoleId = null) {
  if (!supabase) return missing();
  const { data, error } = await supabase.rpc('tgd_assign_customer_user_custom_role', {
    p_user_profile_id: userProfileId,
    p_custom_role_id: customRoleId,
  });
  return { data, error };
}

export async function createCustomerAdminTeamUser(authUserId, payload = {}) {
  if (!supabase) return missing();
  const { data, error } = await supabase.rpc('tgd_customer_admin_create_team_user', {
    p_auth_user_id: authUserId,
    p_email: payload.email,
    p_display_name: payload.displayName ?? null,
    p_first_name: payload.firstName ?? null,
    p_last_name: payload.lastName ?? null,
  });
  return { data, error };
}

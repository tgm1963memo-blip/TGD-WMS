import { supabase } from './supabaseClient.js';

function missing() {
  return { data: null, error: new Error('Supabase client not configured.') };
}

export async function listRoleAreaPermissions() {
  if (!supabase) return missing();
  return supabase
    .from('tgd_role_area_permissions')
    .select('id, role_code, permission_area, is_allowed, updated_at')
    .order('role_code')
    .order('permission_area');
}

export async function saveRoleAreaPermissionOverrides(roleCode, diff = {}) {
  if (!supabase) return missing();
  const payload = [
    ...(diff.toDelete ?? []).map((area) => ({
      permission_area: area,
      reset: true,
    })),
    ...(diff.toUpsert ?? []).map((row) => ({
      permission_area: row.permission_area,
      is_allowed: row.is_allowed,
    })),
  ];
  const { data, error } = await supabase.rpc('tgd_save_role_area_permission_overrides', {
    p_role_code: roleCode,
    p_overrides: payload,
  });
  return { data, error };
}

export async function resetRoleAreaPermissions(roleCode) {
  if (!supabase) return missing();
  const { data, error } = await supabase.rpc('tgd_reset_role_area_permissions', {
    p_role_code: roleCode,
  });
  return { data, error };
}

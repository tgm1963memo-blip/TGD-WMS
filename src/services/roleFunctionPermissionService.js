import { supabase } from './supabaseClient.js';

function missing() {
  return { data: null, error: new Error('Supabase client not configured.') };
}

export async function listRoleFunctionPermissions() {
  if (!supabase) return missing();
  return supabase
    .from('tgd_role_function_permissions')
    .select('id, role_code, function_key, is_allowed, access_level, updated_at')
    .order('role_code')
    .order('function_key');
}

export async function saveRoleFunctionPermissionOverrides(roleCode, diff = {}) {
  if (!supabase) return missing();
  const payload = [
    ...(diff.toDelete ?? []).map((functionKey) => ({
      function_key: functionKey,
      reset: true,
    })),
    ...(diff.toUpsert ?? []).map((row) => ({
      function_key: row.function_key,
      is_allowed: row.is_allowed,
      ...(row.access_level ? { access_level: row.access_level } : {}),
    })),
  ];
  const { data, error } = await supabase.rpc('tgd_save_role_function_permission_overrides', {
    p_role_code: roleCode,
    p_overrides: payload,
  });
  return { data, error };
}

export async function resetRoleFunctionPermissions(roleCode) {
  if (!supabase) return missing();
  const { data, error } = await supabase.rpc('tgd_reset_role_function_permissions', {
    p_role_code: roleCode,
  });
  return { data, error };
}

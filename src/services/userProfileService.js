import { supabase } from './supabaseClient.js';

function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

let _profilePromise = null;

export async function getCurrentUserProfile(providedAuthUserId = null) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  const authUserId = providedAuthUserId;

  if (!authUserId) {
    return { data: null, error: new Error('No active session') };
  }
  if (_profilePromise) {
    return _profilePromise;
  }

  _profilePromise = (async () => {
    try {
      const res = await supabase
        .from('tgd_user_profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      return res;
    } finally {
      _profilePromise = null;
    }
  })();

  return _profilePromise;
}

export async function getUserProfiles(filters = {}) {
  if (!supabase) {
    return missingSupabaseClientResult();
  }

  let query = supabase
    .from('tgd_user_profiles')
    .select('id, auth_user_id, email, display_name, role, customer_id, is_active, created_at, updated_at')
    .order('email', { ascending: true });

  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  if (typeof filters.isActive === 'boolean') {
    query = query.eq('is_active', filters.isActive);
  }

  if (filters.email) {
    query = query.ilike('email', `%${filters.email}%`);
  }

  return query;
}

export async function hasRole(role) {
  const { data, error } = await getCurrentUserProfile();

  if (error || !data) {
    return false;
  }

  return data.role === role;
}

export async function hasAnyRole(roles) {
  const { data, error } = await getCurrentUserProfile();

  if (error || !data) {
    return false;
  }

  return roles.includes(data.role);
}

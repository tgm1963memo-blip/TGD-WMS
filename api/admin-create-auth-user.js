import { createClient } from '@supabase/supabase-js';

function getConfig() {
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { supabaseUrl, serviceRole, anonKey } = getConfig();
  if (!supabaseUrl || !serviceRole || !anonKey) {
    return response.status(500).json({ error: 'Server auth configuration missing' });
  }

  const authHeader = request.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return response.status(401).json({ error: 'Authorization required' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return response.status(401).json({ error: 'Invalid session' });
  }

  const profileClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: profile, error: profileError } = await profileClient
    .from('tgd_user_profiles')
    .select('role')
    .eq('auth_user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (profileError) {
    return response.status(500).json({ error: profileError.message });
  }

  if (profile?.role !== 'admin') {
    return response.status(403).json({ error: 'Admin role required' });
  }

  const { email, password } = request.body ?? {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    return response.status(400).json({ error: 'email and password are required' });
  }

  if (normalizedPassword.length < 8) {
    return response.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const serviceClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed, error: listError } = await serviceClient.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    return response.status(500).json({ error: listError.message });
  }

  const existing = listed.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
  if (existing) {
    const { data: updated, error: updateError } = await serviceClient.auth.admin.updateUserById(existing.id, {
      password: normalizedPassword,
      email_confirm: true,
    });
    if (updateError) {
      return response.status(400).json({ error: updateError.message });
    }
    return response.status(200).json({ authUserId: updated.user.id, created: false });
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: normalizedEmail,
    password: normalizedPassword,
    email_confirm: true,
  });

  if (error) {
    return response.status(400).json({ error: error.message });
  }

  return response.status(200).json({ authUserId: data.user.id, created: true });
}

import { supabase } from './supabaseClient.js';

function missingClientAuthResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function getStagingSession() {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const { data, error } = await supabase.auth.getSession();
  return { data: data?.session ?? null, error };
}

export async function signInToStaging(email, password) {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data: data?.session ?? null, error };
}

export async function signOutFromStaging() {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const { error } = await supabase.auth.signOut();
  return { data: null, error };
}

export function subscribeToStagingAuth(onChange) {
  if (!supabase) {
    return { unsubscribe: () => {} };
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session ?? null);
  });

  return {
    unsubscribe: () => data?.subscription?.unsubscribe?.(),
  };
}

export function getPasswordResetRedirectUrl() {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '/reset-password';
  }
  return `${window.location.origin}/reset-password`;
}

export async function requestPasswordReset(email) {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const normalizedEmail = String(email ?? '').trim();
  if (!normalizedEmail) {
    return {
      data: null,
      error: new Error('Email is required.'),
    };
  }

  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  return { data, error };
}

export async function updateStagingPassword(password) {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const { data, error } = await supabase.auth.updateUser({ password });
  return { data: data?.user ?? null, error };
}

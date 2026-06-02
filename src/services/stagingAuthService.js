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

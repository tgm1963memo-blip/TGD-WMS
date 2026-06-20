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

// Exposes the raw auth event type — needed by ResetPasswordPage to distinguish
// INITIAL_SESSION / PASSWORD_RECOVERY from regular SIGNED_IN events.
export function subscribeToAuthEvents(onEvent) {
  if (!supabase) {
    return { unsubscribe: () => {} };
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    onEvent(event, session ?? null);
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
  const normalizedEmail = String(email ?? '').trim();
  if (!normalizedEmail) {
    return { data: null, error: new Error('Email is required.') };
  }

  // Try the server-side SMTP API first (bypasses Supabase email rate limits and
  // avoids Supabase's built-in email which redirects to the Dashboard Site URL).
  try {
    const res = await fetch('/api/send-reset-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      return { data: json, error: null };
    }
    // Any HTTP error from the API (SMTP failure, missing config, etc.) must be
    // surfaced to the user — do NOT fall through to Supabase's built-in email
    // because it uses the Dashboard "Site URL" (may point to localhost in dev).
    return { data: null, error: new Error(json.error ?? 'ส่งอีเมล์ไม่สำเร็จ') };
  } catch {
    // Network error — API endpoint unreachable (e.g. local dev without API server).
    // Fall through to Supabase's built-in email as last resort.
  }

  if (!supabase) {
    return missingClientAuthResult();
  }

  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  return { data, error };
}

export async function verifyRecoveryToken(tokenHash) {
  if (!supabase) {
    return missingClientAuthResult();
  }
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  });
  return { data: data?.session ?? null, error };
}

export async function updateStagingPassword(password) {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const { data, error } = await supabase.auth.updateUser({ password });
  return { data: data?.user ?? null, error };
}

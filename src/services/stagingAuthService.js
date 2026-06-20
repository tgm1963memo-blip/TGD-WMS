import { supabase } from './supabaseClient.js';
import nodemailer from 'nodemailer';

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

// Helper to send reset email via custom SMTP
async function sendResetEmail(email, resetLink) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: 'noreply.ememo@tgm.co.th',
    to: email,
    subject: 'Password Reset Request',
    text: `Click the link to reset your password: ${resetLink}`,
    html: `<p>Click the link to reset your password:</p><a href="${resetLink}">${resetLink}</a>`,
  };

  await transporter.sendMail(mailOptions);
}
}

export async function requestPasswordReset(email) {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const normalizedEmail = String(email ?? '').trim();
  if (!normalizedEmail) {
    return { data: null, error: new Error('Email is required.') };
  }

  // Try Supabase built‑in reset first
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  // If Supabase fails or custom flag is set, fallback to our own email sender
  if (error || process.env.USE_CUSTOM_RESET_EMAIL === 'true') {
    try {
      const resetLink = getPasswordResetRedirectUrl();
      await sendResetEmail(normalizedEmail, resetLink);
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  }

  return { data, error };
}

export async function updateStagingPassword(password) {
  if (!supabase) {
    return missingClientAuthResult();
  }

  const { data, error } = await supabase.auth.updateUser({ password });
  return { data: data?.user ?? null, error };
}

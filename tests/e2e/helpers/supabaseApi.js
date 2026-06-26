/**
 * Direct Supabase REST API helpers for Playwright tests.
 * Use these when you need to call RPCs without going through the UI
 * (e.g. when handheld credentials are not available in CI).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Extract the JWT from localStorage after the app has logged in.
 * Supabase stores the session under a key matching sb-*-auth-token.
 */
export async function getSupabaseToken(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        try {
          const val = JSON.parse(localStorage.getItem(key) || '{}');
          return val.access_token || null;
        } catch { return null; }
      }
    }
    return null;
  });
}

/**
 * Call a Supabase RPC function via the REST API.
 * Returns { data, error } — data is the parsed JSON body, error is set on HTTP error.
 */
export async function callRpc(page, rpcName, params = {}) {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL not set in .env.local');
  const token = await getSupabaseToken(page);
  if (!token) throw new Error('No Supabase auth token found in localStorage — is the user logged in?');

  const response = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: params,
    }
  );

  const body = await response.text();
  let data = null;
  try { data = JSON.parse(body); } catch { data = body; }

  if (!response.ok()) {
    return { data: null, error: { status: response.status(), body: data } };
  }
  return { data, error: null };
}

/**
 * Query a Supabase table via REST (GET).
 * `queryStr` is appended as-is: e.g. 'status=eq.PENDING&select=id,status'
 */
export async function queryTable(page, table, queryStr = '') {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL not set');
  const token = await getSupabaseToken(page);
  if (!token) throw new Error('No auth token');

  const url = `${SUPABASE_URL}/rest/v1/${table}?${queryStr}`;
  const response = await page.request.get(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const body = await response.text();
  let data = null;
  try { data = JSON.parse(body); } catch { data = body; }

  if (!response.ok()) {
    return { data: null, error: { status: response.status(), body: data } };
  }
  return { data, error: null };
}

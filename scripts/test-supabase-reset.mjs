// scripts/test-supabase-reset.mjs
// Run: node scripts/test-supabase-reset.mjs <email>
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env.local manually
const envPath = join(__dirname, '../.env.local');
const env = {};
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
} catch (e) {
  console.error('Could not read .env.local:', e.message);
  process.exit(1);
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const testEmail = process.argv[2] || env.UAT_EMAIL || 'test@example.com';

console.log('Supabase URL:', supabaseUrl);
console.log('Testing password reset for:', testEmail);
console.log('---');

const origin = env.UAT_BASE_URL || 'https://tgc-wms.vercel.app';
const redirectTo = `${origin}/reset-password`;

try {
  const res = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ email: testEmail, gotrue_meta_security: {}, redirect_to: redirectTo }),
  });

  const text = await res.text();
  console.log('HTTP Status:', res.status);
  try {
    const json = JSON.parse(text);
    console.log('Response JSON:', JSON.stringify(json, null, 2));
    if (json.error || json.msg || json.message) {
      console.log('\n❌ SUPABASE ERROR:', json.error ?? json.msg ?? json.message);
    } else {
      console.log('\n✅ Supabase accepted the request (email may have been sent)');
    }
  } catch {
    console.log('Response text:', text);
  }
} catch (e) {
  console.error('\n❌ Network error:', e.message);
}

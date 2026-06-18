import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.UAT_EMAIL || 'thitiwat.tan@tgm.co.th';
const password = process.env.UAT_PASSWORD;
const customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const docNo = `RPC-PROBE-${Date.now()}`;

if (!url || !anon || !password) {
  console.error('Missing Supabase URL/anon key or UAT_PASSWORD');
  process.exit(1);
}

const supabase = createClient(url, anon);

const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) {
  console.log(JSON.stringify({ ok: false, step: 'signIn', error: signInError.message }, null, 2));
  process.exit(1);
}

const { data: profile } = await supabase
  .from('tgd_user_profiles')
  .select('id, email, role, is_active')
  .eq('auth_user_id', signInData.user.id)
  .maybeSingle();

const { data: rpcData, error: rpcError } = await supabase.rpc('tgd_rpc_create_receiving_draft', {
  p_customer_id: customerId,
  p_document_no: docNo,
});

console.log(JSON.stringify({
  ok: !rpcError,
  email,
  userId: signInData.user.id,
  profile,
  docNo,
  rpcData,
  rpcError: rpcError?.message ?? null,
}, null, 2));

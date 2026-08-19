import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const PROJECT_REF = 'lievvsqbosvrolkrftna';

function getServiceRoleKey() {
  const raw = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) throw new Error('Unable to parse Supabase API keys output');
  const payload = JSON.parse(raw.slice(jsonStart));
  const key = payload.keys?.find((row) => row.name === 'service_role')?.api_key;
  if (!key) throw new Error('service_role key not found');
  return key;
}

async function main() {
  const targetNo = 'CWR-20260727-0006';
  console.log(`Getting service role key...`);
  const serviceKey = getServiceRoleKey();
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: cwrRows, error: cwrFindErr } = await supabase
    .from('tgd_customer_withdrawal_requests')
    .select('id, withdrawal_no')
    .eq('withdrawal_no', targetNo);

  if (cwrFindErr) throw new Error(`CWR lookup failed: ${cwrFindErr.message}`);

  if (cwrRows.length === 0) {
    console.log(`Document ${targetNo} not found.`);
    return;
  }

  const cwrIds = cwrRows.map((r) => r.id);
  console.log(`Deleting ${targetNo} (IDs: ${cwrIds.join(', ')})...`);

  const { error: cwrLinesErr } = await supabase
    .from('tgd_customer_withdrawal_request_lines')
    .delete()
    .in('withdrawal_request_id', cwrIds);
  if (cwrLinesErr) throw new Error(`CWR lines delete failed: ${cwrLinesErr.message}`);

  const { error: cwrErr } = await supabase
    .from('tgd_customer_withdrawal_requests')
    .delete()
    .in('id', cwrIds);
  if (cwrErr) throw new Error(`CWR delete failed: ${cwrErr.message}`);

  console.log('Successfully deleted the document.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

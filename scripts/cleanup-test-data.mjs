/**
 * Deletes test CDR and CWR records created during automated tests.
 * Targets records whose request_no/withdrawal_no matches CDR-YYYYMMDD-* or CWR-YYYYMMDD-*.
 *
 * Usage:
 *   node scripts/cleanup-test-data.mjs                    # cleans today's test data
 *   node scripts/cleanup-test-data.mjs --date 20260618    # cleans specific date
 *   node scripts/cleanup-test-data.mjs --all              # cleans ALL CDR/CWR test records
 */

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

function getTodayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function main() {
  const args = process.argv.slice(2);
  const allFlag = args.includes('--all');
  const dateIdx = args.indexOf('--date');
  const dateStr = dateIdx >= 0 ? args[dateIdx + 1] : getTodayString();

  const prefix = allFlag ? null : dateStr;
  const description = allFlag ? 'ALL test records' : `records for date ${dateStr}`;

  console.log(`\nCleanup target: ${description}`);
  console.log('Getting service role key...');

  const serviceKey = getServiceRoleKey();
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  });

  // Build filter patterns
  const cdrPattern = allFlag ? 'CDR-%' : `CDR-${prefix}-%`;
  const cwrPattern = allFlag ? 'CWR-%' : `CWR-${prefix}-%`;

  console.log(`\nCDR pattern: ${cdrPattern}`);
  console.log(`CWR pattern: ${cwrPattern}`);

  // 1. Find CDR IDs
  const { data: cdrRows, error: cdrFindErr } = await supabase
    .from('tgd_customer_deposit_requests')
    .select('id, request_no')
    .like('request_no', cdrPattern);

  if (cdrFindErr) throw new Error(`CDR lookup failed: ${cdrFindErr.message}`);

  console.log(`\nFound ${cdrRows.length} CDR records to delete:`);
  cdrRows.forEach((r) => console.log(`  - ${r.request_no} (${r.id})`));

  // 2. Delete CDR lines first (FK constraint)
  if (cdrRows.length > 0) {
    const cdrIds = cdrRows.map((r) => r.id);
    const { error: linesErr } = await supabase
      .from('tgd_customer_deposit_request_lines')
      .delete()
      .in('deposit_request_id', cdrIds);
    if (linesErr) throw new Error(`CDR lines delete failed: ${linesErr.message}`);
    console.log(`  Deleted CDR lines for ${cdrIds.length} request(s).`);

    const { error: cdrErr } = await supabase
      .from('tgd_customer_deposit_requests')
      .delete()
      .in('id', cdrIds);
    if (cdrErr) throw new Error(`CDR delete failed: ${cdrErr.message}`);
    console.log(`  Deleted ${cdrIds.length} CDR header record(s).`);
  }

  // 3. Find CWR IDs
  const { data: cwrRows, error: cwrFindErr } = await supabase
    .from('tgd_customer_withdrawal_requests')
    .select('id, withdrawal_no')
    .like('withdrawal_no', cwrPattern);

  if (cwrFindErr) throw new Error(`CWR lookup failed: ${cwrFindErr.message}`);

  console.log(`\nFound ${cwrRows.length} CWR records to delete:`);
  cwrRows.forEach((r) => console.log(`  - ${r.withdrawal_no} (${r.id})`));

  // 4. Delete CWR lines first (FK constraint)
  if (cwrRows.length > 0) {
    const cwrIds = cwrRows.map((r) => r.id);
    const { error: cwrLinesErr } = await supabase
      .from('tgd_customer_withdrawal_request_lines')
      .delete()
      .in('withdrawal_request_id', cwrIds);
    if (cwrLinesErr) throw new Error(`CWR lines delete failed: ${cwrLinesErr.message}`);
    console.log(`  Deleted CWR lines for ${cwrIds.length} request(s).`);

    const { error: cwrErr } = await supabase
      .from('tgd_customer_withdrawal_requests')
      .delete()
      .in('id', cwrIds);
    if (cwrErr) throw new Error(`CWR delete failed: ${cwrErr.message}`);
    console.log(`  Deleted ${cwrIds.length} CWR header record(s).`);
  }

  console.log('\nCleanup complete.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAll(table, select) {
  const PAGE = 1000;
  let rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error) { console.error('ERR', table, error); break; }
    rows = rows.concat(data);
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const depReqs = await fetchAll('tgd_customer_deposit_requests', 'request_no, status, expected_arrival_date, last_action_at, created_at');
console.log('total deposit requests', depReqs.length);
const depAnoms = [];
for (const r of depReqs) {
  if (!r.expected_arrival_date) continue;
  const arrival = new Date(r.expected_arrival_date).getTime();
  const ref = new Date(r.last_action_at || r.created_at).getTime();
  const diffDays = (arrival - ref) / 86400000;
  if (Math.abs(diffDays) > 60) depAnoms.push({ no: r.request_no, status: r.status, expected_arrival_date: r.expected_arrival_date, ref: r.last_action_at || r.created_at, diffDays: Math.round(diffDays) });
}
console.log('DEPOSIT expected_arrival_date anomalies (>60d):', depAnoms.length);
console.log(JSON.stringify(depAnoms, null, 2));

// also check mfg_date/exp_date on deposit lines for implausible values (before 2020 or the exp before mfg)
const depLines = await fetchAll('tgd_customer_deposit_request_lines', 'id, deposit_request_id, tracking_code, lot_no, mfg_date, exp_date, created_at');
const lineAnoms = [];
for (const l of depLines) {
  const created = new Date(l.created_at).getTime();
  if (l.mfg_date) {
    const mfg = new Date(l.mfg_date).getTime();
    if (mfg > created + 86400000) lineAnoms.push({ type: 'mfg_after_created', id: l.id, tracking_code: l.tracking_code, mfg_date: l.mfg_date, created_at: l.created_at });
  }
  if (l.mfg_date && l.exp_date && new Date(l.exp_date) < new Date(l.mfg_date)) {
    lineAnoms.push({ type: 'exp_before_mfg', id: l.id, tracking_code: l.tracking_code, mfg_date: l.mfg_date, exp_date: l.exp_date });
  }
}
console.log('DEPOSIT LINE mfg/exp anomalies:', lineAnoms.length);
console.log(JSON.stringify(lineAnoms, null, 2));

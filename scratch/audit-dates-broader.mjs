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

// 1. Re-confirm withdrawal requested_dispatch_date is now clean, using a tighter threshold
const withReqs = await fetchAll('tgd_customer_withdrawal_requests', 'withdrawal_no, status, requested_dispatch_date, last_action_at, created_at');
const withAnoms = [];
for (const r of withReqs) {
  if (!r.requested_dispatch_date) continue;
  const dispatch = new Date(r.requested_dispatch_date).getTime();
  const ref = new Date(r.last_action_at || r.created_at).getTime();
  const diffDays = (dispatch - ref) / 86400000;
  if (Math.abs(diffDays) > 60) withAnoms.push({ no: r.withdrawal_no, status: r.status, requested_dispatch_date: r.requested_dispatch_date, ref: r.last_action_at || r.created_at, diffDays: Math.round(diffDays) });
}
console.log('WITHDRAWAL requested_dispatch_date anomalies (>60d from last_action/created):', withAnoms.length);
console.log(JSON.stringify(withAnoms, null, 2));

// 2. Deposit requests' expected_arrival_date vs last_action_at/created_at
const depReqs = await fetchAll('tgd_customer_deposit_requests', 'deposit_no, status, expected_arrival_date, last_action_at, created_at');
const depAnoms = [];
for (const r of depReqs) {
  if (!r.expected_arrival_date) continue;
  const arrival = new Date(r.expected_arrival_date).getTime();
  const ref = new Date(r.last_action_at || r.created_at).getTime();
  const diffDays = (arrival - ref) / 86400000;
  if (Math.abs(diffDays) > 60) depAnoms.push({ no: r.deposit_no, status: r.status, expected_arrival_date: r.expected_arrival_date, ref: r.last_action_at || r.created_at, diffDays: Math.round(diffDays) });
}
console.log('DEPOSIT expected_arrival_date anomalies (>60d from last_action/created):', depAnoms.length);
console.log(JSON.stringify(depAnoms, null, 2));

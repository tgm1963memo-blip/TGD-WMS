import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// System-wide: for every withdrawal line with a tracking_code, find the deposit line
// with that same tracking_code and compare customer_product_code.
async function fetchAll(table, select, filterFn) {
  const PAGE = 1000;
  let rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) { console.error('ERR', table, error); break; }
    rows = rows.concat(data);
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const depLines = await fetchAll('tgd_customer_deposit_request_lines', 'id, deposit_request_id, tracking_code, customer_product_code, lot_no', q => q.not('tracking_code', 'is', null));
console.log('deposit lines total:', depLines.length);

const depByTracking = new Map();
const dupTracking = new Set();
for (const d of depLines) {
  if (depByTracking.has(d.tracking_code)) dupTracking.add(d.tracking_code);
  depByTracking.set(d.tracking_code, d);
}
console.log('duplicate tracking codes across deposit lines:', dupTracking.size);

const withLines = await fetchAll('tgd_customer_withdrawal_request_lines', 'id, withdrawal_request_id, tracking_code, customer_product_code, internal_product_code, lot_no, picked_boxes, picked_weight', q => q.not('tracking_code', 'is', null));
console.log('withdrawal lines total:', withLines.length);

const mismatches = [];
for (const w of withLines) {
  const dep = depByTracking.get(w.tracking_code);
  if (dep && dep.customer_product_code !== w.customer_product_code) {
    mismatches.push({
      withdrawalLineId: w.id, withdrawalRequestId: w.withdrawal_request_id,
      trackingCode: w.tracking_code, withdrawalCode: w.customer_product_code, depositCode: dep.customer_product_code,
      lot_no: w.lot_no, picked_boxes: w.picked_boxes, picked_weight: w.picked_weight,
    });
  }
}
console.log('MISMATCH COUNT (system-wide):', mismatches.length);
console.log(JSON.stringify(mismatches, null, 2));

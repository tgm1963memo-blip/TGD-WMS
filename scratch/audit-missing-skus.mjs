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

const depLines = await fetchAll('tgd_customer_deposit_request_lines', 'customer_product_code, internal_product_code, actual_boxes, created_at');
const withLines = await fetchAll('tgd_customer_withdrawal_request_lines', 'customer_product_code, internal_product_code, picked_boxes, requested_boxes, created_at');
const products = await fetchAll('tgd_products', 'id, sku');
const skuSet = new Set(products.map(p => p.sku));

const codeFirstSeen = new Map();
for (const l of depLines) {
  for (const code of [l.customer_product_code, l.internal_product_code]) {
    if (code && !codeFirstSeen.has(code)) codeFirstSeen.set(code, { source: 'deposit', created_at: l.created_at });
  }
}
for (const l of withLines) {
  for (const code of [l.customer_product_code, l.internal_product_code]) {
    if (code && !codeFirstSeen.has(code)) codeFirstSeen.set(code, { source: 'withdrawal', created_at: l.created_at });
  }
}

const missing = [];
for (const [code, info] of codeFirstSeen) {
  if (!skuSet.has(code)) missing.push({ code, ...info });
}
missing.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
console.log('distinct codes seen:', codeFirstSeen.size, '| in tgd_products:', skuSet.size, '| MISSING:', missing.length);
console.log(JSON.stringify(missing, null, 2));

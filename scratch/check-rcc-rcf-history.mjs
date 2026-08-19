import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

for (const code of ['RCC019', 'RCF085', '10010-711', '10010-77', 'RPC048', 'RPC049']) {
  const { data: dep } = await supabase.from('tgd_customer_deposit_request_lines').select('id, tracking_code, lot_no, actual_boxes').eq('customer_product_code', code);
  const { data: wl } = await supabase.from('tgd_customer_withdrawal_request_lines').select('id, tracking_code, lot_no, picked_boxes').eq('customer_product_code', code);
  console.log(code, '-> deposit lines:', dep?.length, 'withdrawal lines:', wl?.length);
}

const { data: cust } = await supabase.from('tgd_customers').select('id, company_name').eq('id', '1def993f-17db-415d-9215-22d9ef5299cd');
console.log(cust);

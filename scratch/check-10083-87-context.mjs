import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: req } = await supabase
  .from('tgd_customer_deposit_requests')
  .select('id, request_no, customer_id, status, last_action_at, created_at')
  .eq('id', '27bc353f-ca71-48da-8256-56c07e3b0bf0');
console.log('deposit request:', JSON.stringify(req, null, 2));

const { data: cust } = await supabase.from('tgd_customers').select('id, company_name').eq('id', '1def993f-17db-415d-9215-22d9ef5299cd');
console.log('customer:', JSON.stringify(cust, null, 2));

// check if there's a withdrawal against this same tracking code that fully depleted it (balance = 0, so it wouldn't show in a "current stock" search)
const { data: wl } = await supabase
  .from('tgd_customer_withdrawal_request_lines')
  .select('id, withdrawal_request_id, tracking_code, picked_boxes, customer_product_code')
  .eq('tracking_code', 'FR260731081');
console.log('withdrawal lines against this tracking code:', JSON.stringify(wl, null, 2));

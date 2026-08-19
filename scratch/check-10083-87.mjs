import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: products, error: pErr } = await supabase
  .from('tgd_customer_products')
  .select('id, customer_id, customer_product_code, internal_product_code, product_name, is_active')
  .eq('customer_product_code', '10083-87');
console.log('catalog matches:', JSON.stringify(products, null, 2), pErr);

const { data: dep, error: dErr } = await supabase
  .from('tgd_customer_deposit_request_lines')
  .select('id, deposit_request_id, customer_product_code, internal_product_code, product_name, lot_no, tracking_code, actual_boxes, created_at')
  .eq('customer_product_code', '10083-87');
console.log('deposit lines:', dep?.length, dErr);
console.log(JSON.stringify(dep, null, 2));

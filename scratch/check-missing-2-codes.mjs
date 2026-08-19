import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

for (const code of ['10272-17', '20231-22']) {
  const { data: cat } = await supabase.from('tgd_customer_products').select('*').eq('customer_product_code', code);
  console.log(code, 'in customer catalog:', JSON.stringify(cat));
  const { data: dep } = await supabase.from('tgd_customer_deposit_request_lines').select('id, deposit_request_id, customer_product_code, product_name, uom, temperature_type, lot_no, tracking_code, actual_boxes, created_at').eq('customer_product_code', code);
  console.log(code, 'deposit lines:', JSON.stringify(dep, null, 2));
}

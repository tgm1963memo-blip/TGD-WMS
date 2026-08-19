import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: dep711 } = await supabase.from('tgd_customer_deposit_request_lines').select('id, tracking_code, lot_no, actual_boxes').eq('customer_product_code', '10010-711');
console.log('10010-711 deposit:', JSON.stringify(dep711));
const { data: dep77 } = await supabase.from('tgd_customer_deposit_request_lines').select('id, tracking_code, lot_no, actual_boxes').eq('customer_product_code', '10010-77');
console.log('10010-77 deposit:', JSON.stringify(dep77));

const { data: wl711 } = await supabase.from('tgd_customer_withdrawal_request_lines').select('id, withdrawal_request_id, tracking_code, lot_no, picked_boxes, requested_boxes').eq('customer_product_code', '10010-711');
console.log('10010-711 withdrawal:', JSON.stringify(wl711, null, 2));

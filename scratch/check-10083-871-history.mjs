import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: dep } = await supabase.from('tgd_customer_deposit_request_lines').select('id, tracking_code, lot_no, actual_boxes, created_at').eq('customer_product_code', '10083-871');
console.log('10083-871 deposit lines (own real stock):', JSON.stringify(dep, null, 2));

const { data: wl } = await supabase.from('tgd_customer_withdrawal_request_lines').select('id, withdrawal_request_id, tracking_code, picked_boxes, requested_boxes, created_at').eq('customer_product_code', '10083-871');
console.log('10083-871 withdrawal lines (all usages):', JSON.stringify(wl, null, 2));

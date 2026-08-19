import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: dep } = await supabase.from('tgd_customer_deposit_request_lines').select('id, tracking_code, lot_no, actual_boxes, created_at').eq('customer_product_code', 'RCC019');
console.log('RCC019 deposit lines:', JSON.stringify(dep, null, 2));

const { data: depRCF } = await supabase.from('tgd_customer_deposit_request_lines').select('id, tracking_code, lot_no, actual_boxes, created_at').eq('customer_product_code', 'RCF085');
console.log('RCF085 deposit lines:', JSON.stringify(depRCF, null, 2));

const { data: wl } = await supabase.from('tgd_customer_withdrawal_request_lines').select('id, withdrawal_request_id, tracking_code, lot_no, picked_boxes, created_at').eq('customer_product_code', 'RCC019').order('created_at');
console.log('RCC019 withdrawal lines:', JSON.stringify(wl, null, 2));

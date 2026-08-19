import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: catalog } = await supabase.from('tgd_customer_products').select('*').eq('customer_product_code', '10083-871');
console.log('catalog entry for 10083-871:', JSON.stringify(catalog, null, 2));

const { data: wl } = await supabase.from('tgd_customer_withdrawal_request_lines').select('*').eq('id', '06493050-ca72-4ba4-99d7-00ce72cc3992');
console.log('withdrawal line:', JSON.stringify(wl, null, 2));

const { data: req } = await supabase.from('tgd_customer_withdrawal_requests').select('id, withdrawal_no, status, customer_id, last_action_at, created_at').eq('id', '9c4aa2cb-d6a1-420e-92e2-b820bf74e5d9');
console.log('withdrawal request:', JSON.stringify(req, null, 2));

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase.from('tgd_customer_withdrawal_request_lines').select('customer_product_code, internal_product_code').eq('id', '06493050-ca72-4ba4-99d7-00ce72cc3992');
console.log(JSON.stringify(data));

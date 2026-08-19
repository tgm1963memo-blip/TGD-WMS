import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase.from('tgd_products').select('*').limit(1);
console.log(JSON.stringify(data, null, 2));

const codes = ['10094-1','10272-17','20231-22','10083-87','10336-227','10044-87','20261-7','10044-1'];
const { data: catalog } = await supabase.from('tgd_customer_products').select('customer_id, customer_product_code, product_name, uom, temperature_type, is_active').in('customer_product_code', codes);
console.log(JSON.stringify(catalog, null, 2));

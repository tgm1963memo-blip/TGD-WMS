import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const codes = ['RCF085', 'RCC019', '10083-87', '10083-871', '3200300000312', '3200300000311', '10010-77', '10010-711', 'RPC049', 'RPC048'];
const { data, error } = await supabase.from('tgd_products').select('id, sku, name').in('sku', codes);
console.log(JSON.stringify(data, null, 2), error);

const { count } = await supabase.from('tgd_products').select('id', { count: 'exact', head: true });
console.log('total tgd_products rows:', count);

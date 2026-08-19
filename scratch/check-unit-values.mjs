import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase.from('tgd_products').select('sku, name, unit').not('unit', 'is', null).limit(10);
console.log(JSON.stringify(data, null, 2));
const { data: nullUnit, count } = await supabase.from('tgd_products').select('id', {count: 'exact', head:true}).is('unit', null);
console.log('null unit count', count);

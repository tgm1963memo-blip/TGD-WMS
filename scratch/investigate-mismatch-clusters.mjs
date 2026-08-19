import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const codes = ['RPC048','RPC049','10010-711','10010-77','RCC019','RCF085'];
const { data: products } = await supabase
  .from('tgd_customer_products')
  .select('customer_id, customer_product_code, internal_product_code, product_name')
  .in('customer_product_code', codes);
console.log(JSON.stringify(products, null, 2));

const withReqIds = ['9d0a1138-2034-4985-ac6a-b67d92322b4e','ec8de10f-4041-44ea-8176-fa129408964d','3c43c863-1258-45f2-9441-88057dcaab48','c9e95c4c-547d-460c-8d24-3fdc54359406','10e389ec-3ce8-455f-b51e-9d1419aa25da','bbb85090-b7b7-4478-adc2-67429b3960af','3f7be9c2-7890-401e-9657-cd01232905a5','ad7118fb-34cf-4e3b-b20d-a6685e64f7f6'];
const { data: reqs } = await supabase.from('tgd_customer_withdrawal_requests').select('id, withdrawal_no, customer_id, status').in('id', withReqIds);
console.log(JSON.stringify(reqs, null, 2));

const custIds = [...new Set((reqs||[]).map(r=>r.customer_id))];
const { data: custs } = await supabase.from('tgd_customers').select('id, company_name').in('id', custIds);
console.log(JSON.stringify(custs, null, 2));

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ids = [
  '98c3c53a-2caa-4a3f-820f-ebe19f8eefd2','131ae468-6d69-405a-8e42-f3eaa9f7b43a','00d376de-d9a0-4549-aac7-4a0273150741',
  '407e6216-f84f-427d-84c6-9131bc2ac8bc','9da79f0b-5d92-4040-bf6b-87bbecae091c','292128a6-e64a-4817-918e-1af10230c96e',
  '15f176f3-ba63-4d03-9e39-94fffbcb6ce2',
  'b65e0c90-c71f-4a05-acf6-7dae36212f32','0a5e9252-8a0f-4ea1-bee9-ecbdcf39346c',
  'bbb3ae6b-bff5-486a-8f75-e48bd99ab54d',
];
const { data } = await supabase.from('tgd_customer_withdrawal_request_lines').select('id, customer_product_code, internal_product_code, product_name').in('id', ids);
console.log(JSON.stringify(data, null, 2));

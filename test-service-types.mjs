import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('tgd_customer_product_service_rates').insert({
    customer_id: '123e4567-e89b-12d3-a456-426614174000', // dummy uuid
    service_type: 'TEST_CUSTOM_SERVICE_123',
    rate: 1.0,
    unit_basis: 'PER_KG',
    currency: 'THB'
  }).select();
  console.log('Insert Error:', error);
  if (!error) {
    await supabase.from('tgd_customer_product_service_rates').delete().eq('service_type', 'TEST_CUSTOM_SERVICE_123');
  }
}
run();

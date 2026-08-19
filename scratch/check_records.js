import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const codes = ['CH260701001', 'CH260701002', 'CH260701003'];

  // Check tgd_customer_deposit_request_lines
  const { data: depositLines, error: err1 } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id, deposit_request_id, tracking_code, temperature_type, customer_product_code, location_id, actual_boxes, actual_weight')
    .in('tracking_code', codes);
  console.log('deposit lines:', err1 || depositLines);

  // Check tgd_stock_movements (does it have tracking code?)
  const { data: movements, error: err2 } = await supabase
    .from('tgd_stock_movements')
    .select('id, tracking_code')
    .in('tracking_code', codes);
  console.log('stock movements:', err2 || movements);

  const { data: withdrawals, error: err6 } = await supabase
    .from('tgd_customer_withdrawal_request_lines')
    .select('*')
    .eq('customer_product_code', '3200300000411');
  console.log('withdrawals:', err6 || withdrawals);
}

check().catch(console.error);

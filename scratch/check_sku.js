import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSku() {
  const { data, error } = await supabase
    .from('tgd_products')
    .select('*')
    .eq('sku', 'RPF024');
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('tgd_products rows with RPF024:');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.length > 0) {
    const productId = data[0].id;
    console.log(`Product ID is: ${productId}`);
    
    // Check if customer_product_code has RPF024 in tgd_customer_products
    const { data: cpData } = await supabase.from('tgd_customer_products').select('*').eq('internal_product_id', productId);
    console.log('tgd_customer_products for this product ID:');
    console.log(JSON.stringify(cpData, null, 2));
    
    // Also check if any other text field in customer_products has RPF024
    const { data: cpSearch } = await supabase.from('tgd_customer_products').select('*').or('customer_product_code.eq.RPF024,internal_product_code.eq.RPF024');
    console.log('tgd_customer_products with RPF024 text:');
    console.log(JSON.stringify(cpSearch, null, 2));
    
    // check deposit request lines
    const { data: dData } = await supabase.from('tgd_customer_deposit_request_lines').select('*').or('customer_product_code.eq.RPF024,internal_product_code.eq.RPF024');
    console.log(`Deposit request lines with RPF024 count: ${dData?.length}`);
    
    // check withdrawal request lines
    const { data: wData } = await supabase.from('tgd_customer_withdrawal_request_lines').select('*').or('customer_product_code.eq.RPF024,internal_product_code.eq.RPF024');
    console.log(`Withdrawal request lines with RPF024 count: ${wData?.length}`);
    
  }
}

checkSku();

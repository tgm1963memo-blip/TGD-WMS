import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runUpdate() {
  console.log('Starting product code update: RPF024 -> RCF024');

  const updates = [
    { table: 'tgd_products', column: 'sku' },
    { table: 'tgd_customer_products', column: 'customer_product_code' },
    { table: 'tgd_customer_products', column: 'internal_product_code' },
    { table: 'tgd_customer_deposit_request_lines', column: 'customer_product_code' },
    { table: 'tgd_customer_deposit_request_lines', column: 'internal_product_code' },
    { table: 'tgd_customer_withdrawal_request_lines', column: 'customer_product_code' },
    { table: 'tgd_customer_withdrawal_request_lines', column: 'internal_product_code' }
  ];

  for (const { table, column } of updates) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update({ [column]: 'RCF024' })
        .eq(column, 'RPF024')
        .select();

      if (error) {
        console.error(`❌ Error updating ${table}.${column}:`, error.message);
      } else {
        console.log(`✅ Updated ${data.length} rows in ${table}.${column}`);
      }
    } catch (e) {
      console.error(`Exception on ${table}.${column}:`, e.message);
    }
  }

  console.log('Update process completed.');
}

runUpdate();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchTable(tableName, columnToSearch) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq(columnToSearch, 'RPF024');
    
  if (error) {
    console.error(`Error querying ${tableName}:`, error.message);
    return;
  }
  
  console.log(`Found ${data.length} records in ${tableName}`);
  if (data.length > 0) {
    console.log(`Sample from ${tableName}:`, JSON.stringify(data[0], null, 2));
  }
}

async function searchTableLike(tableName, columnToSearch) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .ilike(columnToSearch, '%RPF024%');
    
  if (error) {
    console.error(`Error querying ${tableName} (like):`, error.message);
    return;
  }
  
  console.log(`Found ${data.length} records in ${tableName} (like)`);
}


async function main() {
  console.log('Searching for RPF024...');
  
  const tables = [
    { name: 'tgd_customer_products', column: 'product_code' },
    { name: 'tgd_products', column: 'product_code' },
    { name: 'tgd_deposit_lines', column: 'product_code' },
    { name: 'tgd_withdrawal_lines', column: 'product_code' },
    { name: 'tgd_stock_balances', column: 'product_code' },
    { name: 'tgd_lots', column: 'product_code' },
    { name: 'tgd_audit_logs', column: 'details' } // Might not work exactly with eq, we'll see
  ];
  
  for (const table of tables) {
    if (table.name === 'tgd_audit_logs') {
       // skip for eq
    } else {
       await searchTable(table.name, table.column);
    }
  }
  
  await searchTableLike('tgd_customer_products', 'product_code');
  await searchTableLike('tgd_products', 'product_code');
  console.log('Search complete.');
}

main();

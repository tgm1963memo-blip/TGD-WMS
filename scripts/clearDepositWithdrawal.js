// scripts/clearDepositWithdrawal.js
// Script to delete all deposit and withdrawal data in Production
// Uses Supabase client (admin key) from .env.local

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // admin key
console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key length:', supabaseKey ? supabaseKey.length : 'none');
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Service Role Key not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function truncateTable(table) {
  const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error(`Failed to delete from ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`✅ All rows removed from ${table}`);
}

async function main() {
  const tables = [
    'tgd_customer_deposit_receiving_links',
    'tgd_customer_withdrawal_execution_links',
    'tgd_customer_deposit_request_lines',
    'tgd_customer_withdrawal_request_lines',
    'tgd_customer_withdrawal_requests',
    'tgd_receiving_documents',
    'tgd_customer_deposit_requests',
  ];
  for (const tbl of tables) {
    await truncateTable(tbl);
  }
  console.log('All deposit/withdrawal data cleared.');
}

main();

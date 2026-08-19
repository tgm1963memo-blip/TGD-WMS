import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('run_sql', { sql: `
    SELECT pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_class t ON c.conrelid = t.oid 
    WHERE c.conname = 'tgd_product_service_rates_type_check' 
  `});
  if (error) {
    // try direct query using a view or similar if run_sql doesn't exist
    console.log(error);
  } else {
    console.log(data);
  }
}
run();

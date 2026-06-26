import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // USE SERVICE ROLE

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const code = '42-L-19-03';
  console.log("Checking location:", code);
  
  const { data: locations, error: locError } = await supabase
    .from('tgd_locations')
    .select('*')
    .eq('location_code', code);
    
  if (locError) {
    console.error("Location query error:", locError);
    return;
  }
  
  console.log("Locations found in DB matching code:", locations.length);
  locations.forEach(l => console.log(" - ID:", l.id, "Code:", l.location_code, "Active:", l.is_active));

  for (const loc of locations) {
    const { data: stocks, error: stockError } = await supabase
      .from('tgd_stock_balances')
      .select('*')
      .eq('location_id', loc.id);
      
    if (stockError) {
      console.error("Stock query error:", stockError);
      continue;
    }
    
    console.log(`\nStock for location ID ${loc.id}:`, stocks.length, "rows");
    stocks.forEach(s => console.log(`   - ID: ${s.id}, qty_on_hand: ${s.qty_on_hand}, qty_available: ${s.qty_available}`));
  }
}

check().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // 1. Get all zones and locations (similar to getSectionsWithOccupancy)
  const { data: zones } = await supabase
    .from('tgd_zones')
    .select('id, zone_code, zone_name, temperature_type, is_active, tgd_rooms(id, tgd_locations(id, location_code))')
    .eq('is_active', true)
    .order('zone_code');

  const { data: stockRows } = await supabase
    .from('tgd_stock_balances')
    .select('location_id')
    .gt('qty_on_hand', 0);

  const occupiedSet = new Set((stockRows ?? []).map((s) => s.location_id).filter(Boolean));
  
  let targetLocId = null;
  let targetLocCode = null;

  for (const zone of zones) {
    const locations = (zone.tgd_rooms ?? []).flatMap((r) => r.tgd_locations ?? []);
    for (const l of locations) {
      if (l.location_code === '42-L-19-03') {
        targetLocId = l.id;
        targetLocCode = l.location_code;
        console.log("Found location in getSectionsWithOccupancy:", l.location_code, "ID:", l.id, "isOccupied:", occupiedSet.has(l.id));
      }
    }
  }

  if (targetLocId) {
    // 2. Call getStockAtLocation
    const { data: stocks, error: stockError } = await supabase
      .from('tgd_stock_balances')
      .select('id, qty_on_hand, qty_allocated, qty_available, uom, weight, customer_id, product_id, lot_id, pallet_id, tgd_lots(lot_number, expiry_date)')
      .eq('location_id', targetLocId)
      .gt('qty_on_hand', 0);
      
    console.log("getStockAtLocation returned", stocks?.length, "rows");
    console.log(stocks);
  } else {
    console.log("Location 42-L-19-03 not found in zones/rooms/locations hierarchy!");
  }
}

check().catch(console.error);

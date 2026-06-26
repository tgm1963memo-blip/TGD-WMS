import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  console.log("Starting occupancy audit...");

  // 1. Get all zones/rooms/locations (what the Grid uses)
  const { data: zones, error: zoneErr } = await supabase
    .from('tgd_zones')
    .select('id, zone_code, is_active, tgd_rooms(id, tgd_locations(id, location_code))');

  // 2. Get all stock balances (what the Grid and Popup use)
  const { data: stocks, error: stockErr } = await supabase
    .from('tgd_stock_balances')
    .select('id, location_id, qty_on_hand, qty_allocated');

  if (zoneErr || stockErr) {
    console.error("Fetch error:", zoneErr || stockErr);
    return;
  }

  // Build grid locations map
  const gridLocations = new Map(); // id -> location object
  const gridLocationCodes = new Map(); // code -> array of ids (for dupe checking)

  for (const z of zones) {
    if (!z.is_active) continue; // getSectionsWithOccupancy filters by active zones
    for (const r of z.tgd_rooms || []) {
      for (const l of r.tgd_locations || []) {
        gridLocations.set(l.id, { id: l.id, code: l.location_code });
        if (!gridLocationCodes.has(l.location_code)) {
          gridLocationCodes.set(l.location_code, []);
        }
        gridLocationCodes.get(l.location_code).push(l.id);
      }
    }
  }

  // Build stock balances map
  const stockByLocation = new Map(); // location_id -> total qty
  const popupCounts = new Map(); // location_id -> number of rows with qty > 0

  for (const s of stocks) {
    const locId = s.location_id;
    if (!locId) continue;
    
    // Total qty
    if (!stockByLocation.has(locId)) {
      stockByLocation.set(locId, 0);
    }
    stockByLocation.set(locId, stockByLocation.get(locId) + (s.qty_on_hand || 0));

    // Popup count (getStockAtLocation does .gt('qty_on_hand', 0))
    if (s.qty_on_hand > 0) {
      if (!popupCounts.has(locId)) popupCounts.set(locId, 0);
      popupCounts.set(locId, popupCounts.get(locId) + 1);
    }
  }

  // Audit logic
  const duplicates = [];
  for (const [code, ids] of gridLocationCodes.entries()) {
    if (ids.length > 1) {
      duplicates.push({ code, ids });
    }
  }

  const falseOccupied = [];
  const falseEmpty = [];
  const orphans = [];
  const summaryList = [];

  // Check Grid vs Stock
  for (const [locId, qty] of stockByLocation.entries()) {
    const inGrid = gridLocations.has(locId);
    
    if (!inGrid && qty > 0) {
      orphans.push({ locId, qty });
    }
  }

  // Simulate getSectionsWithOccupancy
  // It checks: occupiedSet.has(l.id) where occupiedSet is built from stock > 0
  for (const [locId, l] of gridLocations.entries()) {
    const qty = stockByLocation.get(locId) || 0;
    const isOccupiedGrid = popupCounts.has(locId) && popupCounts.get(locId) > 0;
    const isOccupiedActual = qty > 0; // conceptually
    const popupRows = popupCounts.get(locId) || 0;

    if (isOccupiedGrid || qty > 0) {
      summaryList.push({
        code: l.code,
        locId: l.id,
        qty: qty,
        gridOccupied: isOccupiedGrid,
        popupCount: popupRows
      });
    }

    if (isOccupiedGrid && qty <= 0) {
      // Technically shouldn't happen if isOccupiedGrid is based on qty > 0
      falseOccupied.push({ code: l.code, qty, gridOccupied: isOccupiedGrid });
    }
    if (!isOccupiedGrid && qty > 0) {
      // This means there's a location with total qty > 0 but NO row has qty > 0 individually.
      // e.g., one row qty=5, one row qty=-5 ?? Wait, if qty=5 it triggers popupCount.
      falseEmpty.push({ code: l.code, qty, gridOccupied: isOccupiedGrid });
    }
  }

  // Print results as JSON for easy consumption by the AI
  const report = {
    duplicates,
    falseOccupied,
    falseEmpty,
    orphans,
    summary: summaryList.sort((a,b) => a.code.localeCompare(b.code))
  };

  console.log("===AUDIT_REPORT_JSON===");
  console.log(JSON.stringify(report, null, 2));
}

runAudit();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('========================================');
  console.log('PHASE 1: DATABASE VALIDATION');
  console.log('========================================\n');

  // 1. tgd_stock_balances columns
  console.log('--- tgd_stock_balances sample ---');
  const { data: sbCols, error: sbErr } = await sb
    .from('tgd_stock_balances')
    .select('*')
    .limit(1);
  if (sbErr) {
    console.log('ERROR:', sbErr.message);
  } else if (sbCols?.length) {
    console.log('Columns:', Object.keys(sbCols[0]).join(', '));
  } else {
    console.log('No rows in tgd_stock_balances');
  }

  // 2. tgd_lots columns
  console.log('\n--- tgd_lots sample ---');
  const { data: lotCols, error: lotErr } = await sb
    .from('tgd_lots')
    .select('*')
    .limit(1);
  if (lotErr) {
    console.log('ERROR:', lotErr.message);
  } else if (lotCols?.length) {
    console.log('Columns:', Object.keys(lotCols[0]).join(', '));
  } else {
    console.log('No rows in tgd_lots');
  }

  // 3. FK JOIN test
  console.log('\n--- FK JOIN test: tgd_stock_balances -> tgd_lots ---');
  const { data: joinTest, error: joinErr } = await sb
    .from('tgd_stock_balances')
    .select('id, lot_id, tgd_lots(id, lot_number, expiry_date)')
    .limit(10);
  if (joinErr) {
    console.log('JOIN ERROR:', joinErr.message);
  } else {
    console.log('Join successful. Rows returned:', joinTest?.length);
    for (const r of (joinTest ?? [])) {
      const lotInfo = r.tgd_lots
        ? `lot_number=${r.tgd_lots.lot_number}, expiry_date=${r.tgd_lots.expiry_date}`
        : 'NULL (no lot record)';
      console.log(`  balance.id=${r.id}, lot_id=${r.lot_id}, tgd_lots: ${lotInfo}`);
    }
  }

  // 4. Total counts
  console.log('\n--- Total row counts ---');
  const { count: sbCount } = await sb
    .from('tgd_stock_balances')
    .select('id', { count: 'exact', head: true });
  const { count: lotCount } = await sb
    .from('tgd_lots')
    .select('id', { count: 'exact', head: true });
  console.log('tgd_stock_balances:', sbCount);
  console.log('tgd_lots:', lotCount);

  // 5. Orphan check
  console.log('\n--- Orphan lot_ids (balance.lot_id NOT IN tgd_lots) ---');
  const { data: allBal } = await sb
    .from('tgd_stock_balances')
    .select('id, lot_id');
  const { data: allLots } = await sb
    .from('tgd_lots')
    .select('id');
  const lotIdSet = new Set((allLots ?? []).map(l => l.id));
  const orphans = (allBal ?? []).filter(b => b.lot_id && !lotIdSet.has(b.lot_id));
  console.log('Orphan count:', orphans.length);
  for (const o of orphans) {
    console.log(`  ORPHAN: balance.id=${o.id}, lot_id=${o.lot_id}`);
  }

  // 6. Balances with NULL lot_id
  const nullLots = (allBal ?? []).filter(b => !b.lot_id);
  console.log('Balances with NULL lot_id:', nullLots.length);

  // 7. Duplicate check (same lot_id + location_id)
  console.log('\n--- Duplicate check ---');
  const { data: allBalFull } = await sb
    .from('tgd_stock_balances')
    .select('id, lot_id, location_id');
  const dupeMap = new Map();
  for (const b of (allBalFull ?? [])) {
    const key = `${b.lot_id}|${b.location_id}`;
    if (!dupeMap.has(key)) dupeMap.set(key, []);
    dupeMap.get(key).push(b.id);
  }
  let dupeCount = 0;
  for (const [key, ids] of dupeMap.entries()) {
    if (ids.length > 1) {
      dupeCount++;
      console.log(`  DUPLICATE: key=${key}, ids=[${ids.join(', ')}]`);
    }
  }
  console.log('Duplicate groups:', dupeCount);

  // 8. Expiry date SQL validation
  console.log('\n========================================');
  console.log('PHASE 6: SQL VALIDATION');
  console.log('========================================\n');

  const { data: joinAll } = await sb
    .from('tgd_stock_balances')
    .select('id, lot_id, created_at, tgd_lots(expiry_date)');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sqlNoExpiry = 0;
  let sqlExpired = 0;
  let sqlNearExpiry = 0;
  let sqlGood = 0;
  const totalRows = (joinAll ?? []).length;

  for (const row of (joinAll ?? [])) {
    const expStr = row.tgd_lots?.expiry_date;
    if (!expStr) {
      sqlNoExpiry++;
      continue;
    }
    const exp = new Date(expStr);
    if (exp < today) {
      sqlExpired++;
    } else {
      const diffMs = exp.getTime() - today.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) {
        sqlNearExpiry++;
      } else {
        sqlGood++;
      }
    }
  }

  console.log('Total rows:', totalRows);
  console.log('SQL => NO_EXPIRY_DATE:', sqlNoExpiry);
  console.log('SQL => EXPIRED:', sqlExpired);
  console.log('SQL => NEAR_EXPIRY:', sqlNearExpiry);
  console.log('SQL => GOOD:', sqlGood);
  console.log('');
  console.log('VALIDATION: sum check =', sqlNoExpiry + sqlExpired + sqlNearExpiry + sqlGood, '=== totalRows', totalRows);
  console.log('MATCH:', (sqlNoExpiry + sqlExpired + sqlNearExpiry + sqlGood) === totalRows ? 'YES ✅' : 'NO ❌');

  console.log('\n========================================');
  console.log('PHASE 1 & 6 COMPLETE');
  console.log('========================================');
}

run().catch(e => { console.error(e); process.exit(1); });

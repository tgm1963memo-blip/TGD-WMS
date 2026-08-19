import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function update() {
  const codes = ['CH260701001', 'CH260701002', 'CH260701003'];

  // Find max sequence for FR260701
  const { data: existing, error: errSearch } = await supabase
    .from('tgd_customer_deposit_request_lines')
    .select('tracking_code')
    .like('tracking_code', 'FR260701%')
    .order('tracking_code', { ascending: false })
    .limit(1);

  if (errSearch) {
    console.error('Failed to search max sequence:', errSearch);
    return;
  }

  let nextSeq = 1;
  if (existing && existing.length > 0) {
    const maxCode = existing[0].tracking_code;
    const seqStr = maxCode.substring(8); // FR260701 is 8 chars
    nextSeq = parseInt(seqStr, 10) + 1;
  }

  for (const code of codes) {
    const newCode = `FR260701${String(nextSeq).padStart(3, '0')}`;
    nextSeq++;
    
    console.log(`Updating ${code} to ${newCode} and FROZEN...`);
    const { data, error } = await supabase
      .from('tgd_customer_deposit_request_lines')
      .update({ 
        tracking_code: newCode, 
        temperature_type: 'FROZEN' 
      })
      .eq('tracking_code', code)
      .select('id, tracking_code, temperature_type');

    if (error) {
      console.error(`Failed to update ${code}:`, error);
    } else {
      console.log(`Updated successfully:`, data);
    }
  }
}

update().catch(console.error);

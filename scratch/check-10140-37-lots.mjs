import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: lines, error } = await supabase
  .from('tgd_customer_deposit_request_lines')
  .select('id, deposit_request_id, customer_product_code, lot_no, tracking_code, mfg_date, exp_date, actual_boxes, actual_weight, expected_boxes, expected_weight')
  .eq('customer_product_code', '10140-37')
  .order('mfg_date', { ascending: true });
console.log('error:', error);
console.log('all deposit lines for 10140-37, ordered by mfg_date:');
console.table(lines.map(l => ({ lot: l.lot_no, tracking: l.tracking_code, mfg: l.mfg_date, exp: l.exp_date, boxes: l.actual_boxes, weight: l.actual_weight })));

const depIds = [...new Set(lines.map(l => l.deposit_request_id))];
const { data: reqs } = await supabase.from('tgd_customer_deposit_requests').select('id, request_no, status, customer_id').in('id', depIds);
console.log('deposit requests:', JSON.stringify(reqs, null, 2));

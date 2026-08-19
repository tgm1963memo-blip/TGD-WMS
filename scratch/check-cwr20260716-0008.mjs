import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase
  .from('tgd_customer_withdrawal_requests')
  .select('id, withdrawal_no, status, requested_dispatch_date, last_action_at, created_at')
  .eq('withdrawal_no', 'CWR-20260716-0008');
console.log(JSON.stringify(data, null, 2));

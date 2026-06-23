import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { resolveServiceRoleKey } from './lib/uatSupabaseAdmin.mjs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const url = process.env.VITE_SUPABASE_URL;
if (!url) throw new Error('Missing VITE_SUPABASE_URL');

const { key } = resolveServiceRoleKey();
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await supabase
  .from('tgd_products')
  .delete()
  .not('id', 'is', null)
  .select('id');

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
console.log(`Deleted ${data?.length ?? 0} product(s):`);
(data ?? []).forEach((r) => console.log(`  - ${r.id}`));
console.log('Done.');

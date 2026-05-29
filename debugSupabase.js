import { getSupabaseConfigStatus } from './src/config/supabaseConfig.js';
// @ts-ignore
import.meta.env = { VITE_SUPABASE_URL: 'http://invalid-url.com', VITE_SUPABASE_ANON_KEY: 'validanonkey1234' };
console.log(JSON.stringify(getSupabaseConfigStatus(), null, 2));

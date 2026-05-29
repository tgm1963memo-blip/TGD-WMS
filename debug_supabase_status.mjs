import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust import path
import { getSupabaseConfigStatus } from './src/config/supabaseConfig.js';

function setEnv(url, anon) {
  import.meta.env = { VITE_SUPABASE_URL: url ?? '', VITE_SUPABASE_ANON_KEY: anon ?? '' };
}

setEnv('', '');
console.log('Status missing env:', getSupabaseConfigStatus());

setEnv('https://example.supabase.co', '');
console.log('Missing anon:', getSupabaseConfigStatus());

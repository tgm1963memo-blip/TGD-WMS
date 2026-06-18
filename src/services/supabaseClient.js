import { createClient } from '@supabase/supabase-js';

/** Strip BOM and invisible Unicode chars that corrupt HTTP headers. */
function cleanEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/[\uFEFF\u200B\u200C\u200D\u00AD\u2060\uFFFE]/g, '').trim();
}

const supabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;


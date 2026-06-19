import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env.local') });

function getServiceRoleKey() {
  const raw = execSync('npx supabase projects api-keys --project-ref lievvsqbosvrolkrftna', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) throw new Error('Unable to parse Supabase API keys output');
  const payload = JSON.parse(raw.slice(jsonStart));
  const key = payload.keys?.find((row) => row.name === 'service_role')?.api_key;
  if (!key) throw new Error('service_role key not found');
  return key;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRole = getServiceRoleKey();
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test.admin@tgd-wms.local',
    password: 'password123',
    email_confirm: false,
  });

  console.log("Create user result:", data, error);
}

main().catch(console.error);

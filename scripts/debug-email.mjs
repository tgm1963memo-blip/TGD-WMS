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
  const payload = JSON.parse(raw.slice(jsonStart));
  return payload.keys?.find((row) => row.name === 'service_role')?.api_key;
}

async function main() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin.test@tgd-wms.local',
    password: 'password123',
    email_confirm: true,
  });

  console.log("Result:", data, error);
}

main().catch(console.error);

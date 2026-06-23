import { createUatAdminClient } from './lib/uatSupabaseAdmin.mjs';

async function main() {
  const { supabase, keySource } = createUatAdminClient({ allowCliFallback: true });

  const { count: profileCount, error: profileError } = await supabase
    .from('tgd_user_profiles')
    .select('*', { count: 'exact', head: true });

  if (profileError) {
    throw new Error(`Service role key invalid for tgd_user_profiles: ${profileError.message}`);
  }

  const { data: users, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (authError) {
    throw new Error(`Service role key invalid for auth admin API: ${authError.message}`);
  }

  console.log(JSON.stringify({
    ok: true,
    keySource,
    profileCount: profileCount ?? 0,
    authApiReachable: true,
    sampleAuthUsers: users?.users?.length ?? 0,
    note: keySource === 'cli-legacy-service_role'
      ? 'Prefer sb_secret_* in SUPABASE_SERVICE_ROLE_KEY after Dashboard rotation'
      : 'Using configured SUPABASE_SERVICE_ROLE_KEY',
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message || String(error) }, null, 2));
  process.exit(1);
});

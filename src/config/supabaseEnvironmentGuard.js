const PRODUCTION_MARKERS = [
  /production/i,
  /prod\.supabase/i,
  /-prod[.-]/i,
];

const UAT_DEV_APPLY_ALLOWED = new Set(['uat', 'dev', 'staging', 'local']);

export function maskSupabaseProjectRef(url = '') {
  const match = String(url).match(/https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? 'unknown';
}

export function classifySupabaseEnvironment({
  supabaseUrl = '',
  appEnv = '',
  viteAppEnv = '',
} = {}) {
  const normalizedAppEnv = String(viteAppEnv || appEnv || 'development').trim().toLowerCase();
  const url = String(supabaseUrl || '').trim();

  if (normalizedAppEnv === 'production' || PRODUCTION_MARKERS.some((pattern) => pattern.test(url))) {
    return {
      classification: 'production',
      isProduction: true,
      isUatOrDev: false,
      canApplyMigration: false,
      reason: 'Production markers detected in APP_ENV or Supabase URL.',
    };
  }

  if (UAT_DEV_APPLY_ALLOWED.has(normalizedAppEnv)) {
    return {
      classification: normalizedAppEnv,
      isProduction: false,
      isUatOrDev: true,
      canApplyMigration: true,
      reason: `APP_ENV=${normalizedAppEnv}`,
    };
  }

  return {
    classification: 'unknown',
    isProduction: false,
    isUatOrDev: false,
    canApplyMigration: false,
    reason: 'Supabase environment is not explicitly labeled UAT/DEV/Staging/Local.',
  };
}

export function assertMigrationApplyAllowed(environmentStatus) {
  if (environmentStatus?.isProduction) {
    throw new Error('BLOCKED: Supabase Production environment detected.');
  }

  if (!environmentStatus?.canApplyMigration) {
    throw new Error(`BLOCKED: ${environmentStatus?.reason ?? 'Environment not confirmed for migration apply.'}`);
  }

  return true;
}

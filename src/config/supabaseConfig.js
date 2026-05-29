// Ensure import.meta.env can be overridden in Vitest
if (typeof import.meta !== 'undefined') {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(import.meta, 'env');
    if (!descriptor || !descriptor.writable) {
      Object.defineProperty(import.meta, 'env', {
        value: descriptor?.value || {},
        writable: true,
        configurable: true,
      });
    }
  } catch (e) {
    // ignore any errors
  }
}

/** Helper to mask a value for display.
 * Shows first 4 and last 4 characters (if length > 8), otherwise returns "••••".
 */
export function maskSupabaseValue(value) {
  if (!value) return "••••";
  const len = value.length;
  if (len <= 8) return "••••";
  const first = value.slice(0, 4);
  const last = value.slice(-4);
  return `${first}••••${last}`;
}

/** Wrapper to read environment variables.
 * In test mode, reads from globalThis.__supabaseTestEnv if present.
 * Otherwise falls back to import.meta.env.
 */
function getEnvValue(key) {
  if (globalThis.__supabaseTestEnv && key in globalThis.__supabaseTestEnv) {
    return globalThis.__supabaseTestEnv[key];
  }
  return import.meta.env?.[key];
}

/** Retrieve raw config from environment variables at call time. */
export function getSupabaseConfig() {
  const supabaseUrl = getEnvValue('VITE_SUPABASE_URL') ?? "";
  const supabaseAnonKey = getEnvValue('VITE_SUPABASE_ANON_KEY') ?? "";
  return { supabaseUrl, supabaseAnonKey };
}

/** Validate the Supabase configuration and return an array of issue strings. */
export function validateSupabaseConfig() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const issues = [];

  // URL validation
  if (!supabaseUrl) {
    issues.push("VITE_SUPABASE_URL is missing");
  } else {
    const urlPattern = /^https:\/\/[^/]+\.supabase\.(co|com)(\/.*)?$/i;
    if (!urlPattern.test(supabaseUrl)) {
      issues.push("VITE_SUPABASE_URL has invalid format");
    }
    if (/service[_-]?role/i.test(supabaseUrl)) {
      issues.push("Supabase URL appears to contain a service_role key");
    }
  }

  // Anon key validation
  if (!supabaseAnonKey) {
    issues.push("VITE_SUPABASE_ANON_KEY is missing");
  } else {
    if (/service[_-]?role/i.test(supabaseAnonKey)) {
      issues.push("Supabase anon key appears to be a service_role key");
    }
    if (supabaseAnonKey.length < 8) {
      issues.push("VITE_SUPABASE_ANON_KEY appears to be a placeholder");
    }
  }

  return issues;
}

/** Compute a status object describing overall readiness and safety. */
export function getSupabaseConfigStatus() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const issues = validateSupabaseConfig();

  const urlConfigured = !!supabaseUrl && !issues.some(i => i.includes("VITE_SUPABASE_URL is missing") || i.includes("invalid format") || i.toLowerCase().includes("service_role"));
  const anonKeyConfigured = !!supabaseAnonKey && !issues.some(i => i.includes("VITE_SUPABASE_ANON_KEY is missing") || i.includes("placeholder") || i.toLowerCase().includes("service_role"));
  const serviceRoleExposed = issues.some(i => i.toLowerCase().includes("service_role"));

  const isConfigured = urlConfigured && anonKeyConfigured && !serviceRoleExposed && issues.length === 0;
  const isSafeForFrontend = isConfigured && !serviceRoleExposed;

  const maskedUrl = maskSupabaseValue(supabaseUrl);
  const maskedAnonKey = maskSupabaseValue(supabaseAnonKey);

  const nextActions = [];
  if (!urlConfigured) nextActions.push("Set VITE_SUPABASE_URL");
  if (!anonKeyConfigured) nextActions.push("Set VITE_SUPABASE_ANON_KEY");
  if (serviceRoleExposed) nextActions.push("Remove service_role key from env");
  if (issues.some(i => i.includes("VITE_SUPABASE_URL has invalid format"))) nextActions.push("Correct VITE_SUPABASE_URL format");
  if (issues.some(i => i.includes("VITE_SUPABASE_ANON_KEY appears to be a placeholder"))) nextActions.push("Provide real VITE_SUPABASE_ANON_KEY");

  return {
    isConfigured,
    isSafeForFrontend,
    urlConfigured,
    anonKeyConfigured,
    serviceRoleExposed,
    maskedUrl,
    maskedAnonKey,
    issues,
    nextActions,
    schemaValid: true, // frontend schema validation placeholder
    connectionValid: true, // connection test placeholder
  };
}

/** Convenience to get status or throw when unsafe – used by readiness service. */
export function getSupabaseConfigStatusSafe() {
  const status = getSupabaseConfigStatus();
  if (!status.isSafeForFrontend) {
    throw new Error("Supabase configuration is unsafe or incomplete.");
  }
  return status;
}

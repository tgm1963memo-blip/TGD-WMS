// src/services/supabaseConnectionReadinessService.js
import { getSupabaseConfigStatus } from "../config/supabaseConfig.js";

/**
 * Checks Supabase configuration readiness.
 * Returns the status object from config utilities.
 */
export function checkSupabaseConfigReadiness() {
  return getSupabaseConfigStatus();
}

/**
 * Summarizes readiness for UI consumption.
 * Returns a simplified object without exposing any secret values.
 */
export function summarizeSupabaseReadiness() {
  const status = getSupabaseConfigStatus();
  return {
    ready: status.isConfigured,
    safe: status.isSafeForFrontend,
    urlConfigured: status.urlConfigured,
    anonKeyConfigured: status.anonKeyConfigured,
    serviceRoleExposed: status.serviceRoleExposed,
    clientInitialized: status.isConfigured, // true only when config is valid
    schemaValid: status.schemaValid,
    connectionValid: status.connectionValid,
    // No maskedUrl or maskedAnonKey are exposed to UI
    issues: status.issues,
    nextActions: status.nextActions,
  };
}

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
 * Returns a simplified object with masked values and a readable status.
 */
export function summarizeSupabaseReadiness() {
  const status = getSupabaseConfigStatus();
  return {
    ready: status.isConfigured,
    safe: status.isSafeForFrontend,
    urlConfigured: status.urlConfigured,
    anonKeyConfigured: status.anonKeyConfigured,
    serviceRoleExposed: status.serviceRoleExposed,
    maskedUrl: status.maskedUrl,
    maskedAnonKey: status.maskedAnonKey,
    issues: status.issues,
    nextActions: status.nextActions,
  };
}

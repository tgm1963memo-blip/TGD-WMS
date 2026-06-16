import { isGoLivePresentationEnabled } from '../config/goLivePresentation.js';

export const ALLOWED_UAT_ROLES = Object.freeze(['warehouse_staff', 'supervisor', 'admin']);

/**
 * Safely resolves a UAT-only role override.
 * Must NEVER return an override in standard Production mode.
 * 
 * @param {Object} env Environment variables object (defaults to import.meta.env)
 * @returns {string|null} The overridden role if conditions are met, otherwise null
 */
export function getUatRoleOverride(env = import.meta.env) {
  if (!env) return null;

  if (isGoLivePresentationEnabled()) {
    return null;
  }

  // 1. App must be in controlled UAT mode
  const isUatMode = String(env.VITE_UAT_MODE).toLowerCase() === 'true' || String(env.VITE_APP_ENV).toLowerCase() === 'uat';
  if (!isUatMode) {
    return null;
  }

  // 2. Explicit env var must be set
  const overrideRole = env.VITE_UAT_ROLE_OVERRIDE;
  if (!overrideRole) {
    return null;
  }

  // 3. Requested role must be in the allowed list
  const normalized = String(overrideRole).trim().toLowerCase();
  if (ALLOWED_UAT_ROLES.includes(normalized)) {
    return normalized;
  }

  return null;
}

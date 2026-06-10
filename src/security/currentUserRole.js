// src/security/currentUserRole.js

import { getAppRuntimeConfig } from '../config/appConfig.js';
import { isDemoRoleSelectorAllowed } from './demoRoleSelectorControl.js';
import { getUatRoleOverride } from './uatRoleOverride.js';

/**
 * Frontend‑only demo role source.
 * No persistence, no network, no storage. All data lives in memory only.
 */

export const DEFAULT_DEMO_ROLE = 'admin';
export const PRODUCTION_FALLBACK_ROLE = 'viewer';

let _demoRole = DEFAULT_DEMO_ROLE;

/**
 * Get the current demo user role.
 * @returns {string}
 */
export function getCurrentUserRole() {
  const uatOverride = getUatRoleOverride();
  if (uatOverride) {
    return uatOverride;
  }

  if (!isDemoRoleSelectorAllowed(getAppRuntimeConfig())) {
    return PRODUCTION_FALLBACK_ROLE;
  }

  return _demoRole;
}

/**
 * Set the demo user role (in‑memory only).
 * @param {string} role
 */
export function setDemoUserRole(role) {
  if (!isDemoRoleSelectorAllowed(getAppRuntimeConfig())) {
    _demoRole = PRODUCTION_FALLBACK_ROLE;
    return;
  }

  _demoRole = normalizeUserRole(role);
}

/**
 * Normalise a role string (trim and lower‑case).
 * @param {string} role
 * @returns {string}
 */
export function normalizeUserRole(role) {
  if (!role || typeof role !== 'string') return DEFAULT_DEMO_ROLE;
  return role.trim().toLowerCase();
}

/**
 * List all available demo roles.
 * Mirrors the hierarchy defined in permissionGuard.js.
 * @returns {string[]}
 */
export function listAvailableDemoRoles() {
  return ['admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer'];
}

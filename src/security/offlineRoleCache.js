// Remembers the last role the server confirmed, so an installed handheld
// app reopened with no signal can still pass RoutePermissionGuard instead
// of collapsing to 'viewer'. This only decides which screens render: every
// real read and write is still checked by the server once signal returns,
// and UserRoleProvider re-fetches the profile the moment it does. Only ever
// consulted after a network failure, never when the server answered.

const STORAGE_KEY = 'tgd_offline_role_v1';

// `baseRole` is the built-in role a custom role maps to, kept so route checks
// still work for custom-role users while the role list can't be loaded.
export function saveOfflineRole(userId, { role, baseRole = null, customerId = null, allowedMenuKeys = null }) {
  if (!userId || !role) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, role, baseRole, customerId, allowedMenuKeys }));
  } catch (e) {
    console.warn('[offlineRoleCache] could not save role', e);
  }
}

// null unless the cached entry belongs to this exact user -- on a shared
// device, one person's role must never apply to the next person's session.
export function loadOfflineRole(userId) {
  if (!userId) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return cached?.userId === userId && cached.role ? cached : null;
  } catch {
    return null;
  }
}

export function clearOfflineRole() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was cached either.
  }
}

// A request that never reached the server, as opposed to one the server
// refused. supabase-js surfaces these as "TypeError: Failed to fetch"
// (Chrome), "Load failed" (Safari) or "NetworkError" (Firefox).
export function isNetworkFailure(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return /failed to fetch|load failed|networkerror/i.test(error?.message ?? '');
}

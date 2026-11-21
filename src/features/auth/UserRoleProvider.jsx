import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import { resolveUserProfileRole } from '../../security/supabaseAuthRoleMappingService.js';
import {
  clearAuthenticatedUserRole,
  getCurrentUserRole,
  setAuthenticatedUserRole,
} from '../../security/currentUserRole.js';
import { refreshRoleAreaPermissionCache } from '../../services/roleAreaPermissionCacheService.js';
import { getCustomerCustomRole } from '../../services/customerCustomRoleService.js';
import { resolveCustomRoleBaseRole, setCustomRoleBaseRoles } from '../../security/customRoleBaseRoles.js';
import {
  clearOfflineRole,
  isNetworkFailure,
  loadOfflineRole,
  saveOfflineRole,
} from '../../security/offlineRoleCache.js';

const UserRoleContext = createContext({
  role: 'viewer',
  ready: false,
  customerId: null,
  // null = unrestricted (every existing customer_user's default) — sees
  // every customer-portal menu, same as today. A non-null array restricts
  // the sidebar/route guard to exactly those navigationGroups item keys.
  allowedMenuKeys: null,
});

// Wi-Fi with no internet keeps navigator.onLine true, and the profile request
// then waits out supabase-js's token refresh retries (about 30 seconds).
// With a cached role to fall back on there is no reason to wait that long.
const CACHED_ROLE_WAIT_MS = 6000;
const RECHECK_INTERVAL_MS = 60000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('NetworkError: profile request timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function UserRoleProvider({ children }) {
  const { session, loading: authLoading } = useAuth();
  const sessionUserId = session?.user?.id ?? null;
  const [state, setState] = useState({
    role: getCurrentUserRole(),
    ready: false,
    resolvedUserId: null,
    customerId: null,
    allowedMenuKeys: null,
    // True when the role did not come from a server answer (the offline
    // cache, or 'viewer' because the server could not be reached). It is
    // rechecked until the server answers.
    provisional: false,
  });
  const [recheckCount, setRecheckCount] = useState(0);

  // 'online' alone is not enough: on Wi-Fi with no internet the browser
  // already thinks it is online, so it never fires when internet returns.
  useEffect(() => {
    if (!state.provisional) return undefined;
    const recheck = () => setRecheckCount((count) => count + 1);
    const onVisible = () => { if (document.visibilityState === 'visible') recheck(); };
    window.addEventListener('online', recheck);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(recheck, RECHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', recheck);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [state.provisional]);

  useEffect(() => {
    let active = true;

    function applyOfflineRole() {
      const cached = loadOfflineRole(sessionUserId);
      if (!cached) return false;
      // A custom role only passes route checks through its base role, and
      // that mapping normally comes from the server.
      if (cached.baseRole && cached.baseRole !== cached.role) {
        setCustomRoleBaseRoles([{ role_code: cached.role, base_role: cached.baseRole }]);
      }
      setAuthenticatedUserRole(cached.role);
      setState({
        role: getCurrentUserRole(),
        ready: true,
        resolvedUserId: sessionUserId,
        customerId: cached.customerId,
        allowedMenuKeys: cached.allowedMenuKeys,
        provisional: true,
      });
      return true;
    }

    function applyUnreachableFallback() {
      if (applyOfflineRole()) return;
      setAuthenticatedUserRole('viewer');
      setState({
        role: getCurrentUserRole(),
        ready: true,
        resolvedUserId: sessionUserId,
        customerId: null,
        allowedMenuKeys: null,
        provisional: true,
      });
    }

    if (authLoading) {
      return undefined;
    }

    if (!sessionUserId) {
      clearAuthenticatedUserRole();
      clearOfflineRole();
      if (active) {
        setState({ role: getCurrentUserRole(), ready: true, resolvedUserId: null, customerId: null, allowedMenuKeys: null, provisional: false });
      }
      return undefined;
    }

    // Offline the request below can sit behind supabase-js's token refresh
    // retries for many seconds, so skip it when the answer is already known.
    if (navigator.onLine === false && applyOfflineRole()) {
      return undefined;
    }

    // Rechecking a provisional role must not drop to the "Loading
    // permissions..." screen: RoutePermissionGuard would unmount a handheld
    // job in progress.
    let rechecking = false;
    setState((current) => {
      rechecking = current.provisional && current.resolvedUserId === sessionUserId;
      return {
        ...current,
        ready: rechecking,
        resolvedUserId: current.resolvedUserId === sessionUserId ? current.resolvedUserId : null,
      };
    });

    const hasCachedRole = Boolean(loadOfflineRole(sessionUserId));
    const profileRequest = getCurrentUserProfile(sessionUserId);

    (hasCachedRole ? withTimeout(profileRequest, CACHED_ROLE_WAIT_MS) : profileRequest)
      .then(async (result) => {
        if (!active) return;
        if (result.error && isNetworkFailure(result.error)) {
          applyUnreachableFallback();
          return;
        }
        // A recheck replaces the provisional role only with a real profile.
        // Right after reconnecting, supabase-js may still be in its refresh
        // cooldown and send the request without a user token; the server then
        // answers with no row and no error, which is not a verdict on the role.
        if (rechecking && !result.data) return;

        // Must run before resolveUserProfileRole: it populates the
        // registered-custom-role cache that isKnownWmsRole/normalizeWmsRole
        // check, so a custom role (see RolePermissionsAdminPage /
        // tgd_role_definitions) isn't mistaken for a bogus role string and
        // collapsed to 'viewer' just because this cache hadn't loaded yet.
        const permissionCache = await refreshRoleAreaPermissionCache();
        if (!active) return;
        const resolved = resolveUserProfileRole(result.data);
        // On weak signal the profile can arrive while the role list does not,
        // which makes a valid custom role look unknown. That is a lost
        // request, not a demotion.
        if (permissionCache && !permissionCache.ok && resolved.reason === 'unknown_role') {
          applyUnreachableFallback();
          return;
        }
        setAuthenticatedUserRole(resolved.role);

        // Only a customer_user can be restricted (a customer_admin is
        // never a valid assignment target — see
        // tgd_assign_customer_user_custom_role) — no restriction to
        // resolve otherwise, so allowedMenuKeys stays null (unrestricted).
        let allowedMenuKeys = null;
        if (resolved.role === 'customer_user' && result.data?.customer_custom_role_id) {
          const roleResult = await getCustomerCustomRole(result.data.customer_custom_role_id);
          // A deactivated (or deleted/unreadable) role must NOT fall back
          // to unrestricted access — [] (nothing visible) is the safe
          // default, not null (everything visible).
          allowedMenuKeys = roleResult.data?.is_active ? (roleResult.data.allowed_menu_keys ?? []) : [];
        }
        if (!active) return;

        if (result.data) {
          saveOfflineRole(sessionUserId, {
            role: resolved.role,
            baseRole: resolveCustomRoleBaseRole(resolved.role),
            customerId: result.data.customer_id ?? null,
            allowedMenuKeys,
          });
        }
        setState({
          role: getCurrentUserRole(),
          ready: true,
          resolvedUserId: sessionUserId,
          customerId: result.data?.customer_id ?? null,
          allowedMenuKeys,
          provisional: false,
        });
      })
      .catch((e) => {
        console.error('[UserRoleProvider] getCurrentUserProfile caught error:', e);
        if (!active) return;
        if (isNetworkFailure(e)) {
          applyUnreachableFallback();
          return;
        }
        if (rechecking) return;
        setAuthenticatedUserRole('viewer');
        setState({
          role: getCurrentUserRole(),
          ready: true,
          resolvedUserId: sessionUserId,
          customerId: null,
          allowedMenuKeys: null,
          provisional: false,
        });
      });

    return () => {
      active = false;
    };
  }, [authLoading, sessionUserId, recheckCount]);

  const ready = authLoading
    ? false
    : (!sessionUserId
        ? state.ready
        : state.resolvedUserId === sessionUserId && state.ready);

  const contextValue = {
    role: state.role,
    ready,
    customerId: state.customerId,
    allowedMenuKeys: state.allowedMenuKeys,
  };

  return (
    <UserRoleContext.Provider value={contextValue}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(UserRoleContext);
}

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

const UserRoleContext = createContext({
  role: 'viewer',
  ready: false,
  customerId: null,
  // null = unrestricted (every existing customer_user's default) — sees
  // every customer-portal menu, same as today. A non-null array restricts
  // the sidebar/route guard to exactly those navigationGroups item keys.
  allowedMenuKeys: null,
});

export function UserRoleProvider({ children }) {
  const { session, loading: authLoading } = useAuth();
  const sessionUserId = session?.user?.id ?? null;
  const [state, setState] = useState({
    role: getCurrentUserRole(),
    ready: false,
    resolvedUserId: null,
    customerId: null,
    allowedMenuKeys: null,
  });



  useEffect(() => {
    let active = true;

    if (authLoading) {
      return undefined;
    }

    if (!sessionUserId) {
      clearAuthenticatedUserRole();
      if (active) {
        setState({ role: getCurrentUserRole(), ready: true, resolvedUserId: null, customerId: null, allowedMenuKeys: null });
      }
      return undefined;
    }

    setState((current) => ({
      ...current,
      ready: false,
      resolvedUserId: current.resolvedUserId === sessionUserId ? current.resolvedUserId : null,
    }));

    getCurrentUserProfile(sessionUserId)
      .then(async (result) => {
        if (!active) return;
        // Must run before resolveUserProfileRole: it populates the
        // registered-custom-role cache that isKnownWmsRole/normalizeWmsRole
        // check, so a custom role (see RolePermissionsAdminPage /
        // tgd_role_definitions) isn't mistaken for a bogus role string and
        // collapsed to 'viewer' just because this cache hadn't loaded yet.
        await refreshRoleAreaPermissionCache();
        const resolved = resolveUserProfileRole(result.data);
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

        setState({
          role: getCurrentUserRole(),
          ready: true,
          resolvedUserId: sessionUserId,
          customerId: result.data?.customer_id ?? null,
          allowedMenuKeys,
        });
      })
      .catch((e) => {
        console.error('[UserRoleProvider] getCurrentUserProfile caught error:', e);
        if (!active) return;
        setAuthenticatedUserRole('viewer');
        setState({
          role: getCurrentUserRole(),
          ready: true,
          resolvedUserId: sessionUserId,
          customerId: null,
          allowedMenuKeys: null,
        });
      });

    return () => {
      active = false;
    };
  }, [authLoading, sessionUserId]);

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

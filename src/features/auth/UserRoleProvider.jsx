import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import { resolveUserProfileRole } from '../../security/supabaseAuthRoleMappingService.js';
import {
  clearAuthenticatedUserRole,
  getCurrentUserRole,
  setAuthenticatedUserRole,
} from '../../security/currentUserRole.js';

const UserRoleContext = createContext({
  role: 'viewer',
  ready: false,
});

export function UserRoleProvider({ children }) {
  const { session, loading: authLoading } = useAuth();
  const sessionUserId = session?.user?.id ?? null;
  const [state, setState] = useState({
    role: getCurrentUserRole(),
    ready: false,
    resolvedUserId: null,
  });

  useEffect(() => {
    let active = true;

    if (authLoading) {
      return undefined;
    }

    if (!sessionUserId) {
      clearAuthenticatedUserRole();
      if (active) {
        setState({ role: getCurrentUserRole(), ready: true, resolvedUserId: null });
      }
      return undefined;
    }

    setState((current) => ({
      ...current,
      ready: false,
      resolvedUserId: current.resolvedUserId === sessionUserId ? current.resolvedUserId : null,
    }));

    getCurrentUserProfile()
      .then((result) => {
        if (!active) return;
        const resolved = resolveUserProfileRole(result.data);
        setAuthenticatedUserRole(resolved.role);
        setState({
          role: getCurrentUserRole(),
          ready: true,
          resolvedUserId: sessionUserId,
        });
      })
      .catch(() => {
        if (!active) return;
        setAuthenticatedUserRole('viewer');
        setState({
          role: getCurrentUserRole(),
          ready: true,
          resolvedUserId: sessionUserId,
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

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
  const [state, setState] = useState({ role: getCurrentUserRole(), ready: false });

  useEffect(() => {
    let active = true;

    if (authLoading) {
      return undefined;
    }

    if (!session?.user?.id) {
      clearAuthenticatedUserRole();
      if (active) {
        setState({ role: getCurrentUserRole(), ready: true });
      }
      return undefined;
    }

    setState((current) => ({ ...current, ready: false }));

    getCurrentUserProfile().then((result) => {
      if (!active) return;
      const resolved = resolveUserProfileRole(result.data);
      setAuthenticatedUserRole(resolved.role);
      setState({ role: getCurrentUserRole(), ready: true });
    });

    return () => {
      active = false;
    };
  }, [authLoading, session?.user?.id]);

  return (
    <UserRoleContext.Provider value={state}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(UserRoleContext);
}

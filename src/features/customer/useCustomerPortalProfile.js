import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import { CUSTOMER_PORTAL_WRITE_ROLES } from '../../services/customerPortalServiceUtils.js';

export function useCustomerPortalProfile() {
  const { session, loading: authLoading } = useAuth();
  const [state, setState] = useState({
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    if (authLoading) {
      return undefined;
    }

    if (!session?.user?.id) {
      setState({ profile: null, loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    getCurrentUserProfile().then((result) => {
      if (!active) return;
      setState({
        profile: result.data ?? null,
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => {
      active = false;
    };
  }, [authLoading, session?.user?.id]);

  const role = state.profile?.role ?? '';
  const customerId = state.profile?.customer_id ?? null;
  const canWriteCustomerRequests = CUSTOMER_PORTAL_WRITE_ROLES.includes(role) && Boolean(customerId);

  return {
    ...state,
    role,
    customerId,
    canWriteCustomerRequests,
  };
}

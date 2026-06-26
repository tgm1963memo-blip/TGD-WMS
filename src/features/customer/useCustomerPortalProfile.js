import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import { CUSTOMER_PORTAL_WRITE_ROLES, isCustomerRequestProxyRole } from '../../services/customerPortalServiceUtils.js';

const ADMIN_CUSTOMER_STORAGE_KEY = 'tgd_admin_portal_customer_id';

export function setAdminPortalCustomerId(id) {
  if (id) {
    localStorage.setItem(ADMIN_CUSTOMER_STORAGE_KEY, id);
  } else {
    localStorage.removeItem(ADMIN_CUSTOMER_STORAGE_KEY);
  }
  window.dispatchEvent(new Event('adminPortalCustomerChanged'));
}

export function getAdminPortalCustomerId() {
  return localStorage.getItem(ADMIN_CUSTOMER_STORAGE_KEY);
}

export function useCustomerPortalProfile() {
  const { session, loading: authLoading } = useAuth();
  const [adminSelectedId, setAdminSelectedId] = useState(getAdminPortalCustomerId());
  const [state, setState] = useState({
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const handleStorageChange = () => setAdminSelectedId(getAdminPortalCustomerId());
    window.addEventListener('adminPortalCustomerChanged', handleStorageChange);
    return () => window.removeEventListener('adminPortalCustomerChanged', handleStorageChange);
  }, []);

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

    getCurrentUserProfile(session?.user?.id).then((result) => {
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
  let customerId = state.profile?.customer_id ?? null;
  const isRequestProxy = isCustomerRequestProxyRole(role);
  
  if (isRequestProxy && adminSelectedId) {
    customerId = adminSelectedId;
  }
  
  const canWriteCustomerRequests = (
    (CUSTOMER_PORTAL_WRITE_ROLES.includes(role) && Boolean(customerId))
    || isRequestProxy
  );

  return {
    ...state,
    role,
    customerId,
    isRequestProxy,
    canWriteCustomerRequests,
  };
}

import { Navigate } from 'react-router-dom';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { resolveDefaultHomePath } from '../../security/defaultHomePath.js';
import { useUserRole } from './UserRoleProvider.jsx';

export function DefaultHomeRedirect() {
  const { role, ready, allowedMenuKeys } = useUserRole();

  if (!ready) {
    return <LoadingState message="Loading permissions..." />;
  }

  const homePath = resolveDefaultHomePath(role, allowedMenuKeys);
  return <Navigate to={homePath} replace />;
}

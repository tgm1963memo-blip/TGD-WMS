import { Navigate } from 'react-router-dom';
import { getCurrentUserRole } from '../../security/currentUserRole.js';
import { resolveDefaultHomePath } from '../../security/defaultHomePath.js';

export function DefaultHomeRedirect() {
  const homePath = resolveDefaultHomePath(getCurrentUserRole());
  return <Navigate to={homePath} replace />;
}

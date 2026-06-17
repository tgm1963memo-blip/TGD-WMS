import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PermissionDeniedNotice from '../../components/common/PermissionDeniedNotice.jsx';
import { getRouteAccessDecision } from '../../security/permissionGuard.js';
import { useUserRole } from './UserRoleProvider.jsx';

export function RoutePermissionGuard() {
  const { pathname } = useLocation();
  const { role, ready } = useUserRole();

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--tgd-muted-text)' }}>
        Loading permissions...
      </div>
    );
  }

  const decision = getRouteAccessDecision(role, pathname);
  if (!decision.allowed) {
    return <PermissionDeniedNotice />;
  }

  return <Outlet />;
}

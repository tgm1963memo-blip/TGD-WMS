import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { useUserRole } from './UserRoleProvider.jsx';
import { StagingLoginPanel } from '../../components/dashboard/StagingLoginPanel.jsx';
import { AuthPageShell } from '../../components/auth/AuthPageShell.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { resolveDefaultHomePath } from '../../security/defaultHomePath.js';
import { getRouteAccessDecision } from '../../security/permissionGuard.js';

export function LoginPage() {
  const { session, loading } = useAuth();
  const { role, ready: roleReady, allowedMenuKeys } = useUserRole();
  const location = useLocation();
  const t = useTranslation();
  const goLive = isGoLivePresentationEnabled();

  if (loading) {
    return (
      <div className="layout-auth login-layout auth-page-shell">
        <div className="login-loading">{t('auth_loading')}</div>
      </div>
    );
  }

  if (session?.user) {
    if (!roleReady) {
      return (
        <div className="layout-auth login-layout auth-page-shell">
          <div className="login-loading">{t('auth_loading')}</div>
        </div>
      );
    }

    const homePath = resolveDefaultHomePath(role, allowedMenuKeys);
    const requestedPath = location.state?.from?.pathname;
    const from = requestedPath && getRouteAccessDecision(role, requestedPath, allowedMenuKeys).allowed
      ? requestedPath
      : homePath;
    return <Navigate to={from} replace />;
  }

  return (
    <AuthPageShell
      testId="login-page"
      footer={goLive ? null : (
        <div className="login-footer login-safety-footer meeting-safety-footer" role="status">
          <div>{t('controlled_uat_only')}</div>
          <div>{t('production_hold')}</div>
          <div>{t('final_go_not_authorized')}</div>
        </div>
      )}
    >
      <StagingLoginPanel session={session} onSessionChange={() => {}} />
    </AuthPageShell>
  );
}

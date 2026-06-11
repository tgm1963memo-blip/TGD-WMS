import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { StagingLoginPanel } from '../../components/dashboard/StagingLoginPanel.jsx';
import { AuthPageShell } from '../../components/auth/AuthPageShell.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const t = useTranslation();

  if (loading) {
    return (
      <div className="layout-auth login-layout auth-page-shell">
        <div className="login-loading">{t('auth_loading')}</div>
      </div>
    );
  }

  if (session?.user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return (
    <AuthPageShell
      testId="login-page"
      footer={(
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

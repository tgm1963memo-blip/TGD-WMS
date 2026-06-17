import { Link } from 'react-router-dom';
import { brandConfig } from '../../config/brandConfig.js';
import LanguageToggle from '../common/LanguageToggle.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function AuthPageShell({
  children,
  testId = 'auth-page',
  showBackToLogin = false,
  footer = null,
}) {
  const t = useTranslation();

  return (
    <div className="layout-auth login-layout auth-page-shell" data-testid={testId}>
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <img alt="TGC logo" className="login-brand-logo" src={brandConfig.logoPath} />
          <h1 className="login-brand-title">{brandConfig.brandName}</h1>
          <p className="login-subtitle">{t('login_subtitle')}</p>
        </div>
      </div>
      <div className="login-form-panel">
        <div className="auth-page-toolbar">
          <LanguageToggle />
        </div>
        <div className="login-card auth-page-card">
          {children}
          {showBackToLogin ? (
            <p className="auth-back-link-wrap">
              <Link className="auth-text-link" data-testid="back-to-login-link" to="/login">
                {t('back_to_login')}
              </Link>
            </p>
          ) : null}
          {footer}
        </div>
      </div>
    </div>
  );
}

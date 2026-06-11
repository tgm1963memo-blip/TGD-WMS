import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInToStaging, signOutFromStaging } from '../../services/stagingAuthService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function StagingLoginPanel({ session, onSessionChange }) {
  const t = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signInToStaging(email, password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSessionChange?.(result.data);
    setPassword('');
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);

    const result = await signOutFromStaging();
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSessionChange?.(null);
  }

  return (
    <section className="staging-login-panel" data-testid="staging-login-panel">
      <div className="login-form-header">
        <h2>{t('login_title')}</h2>
        <p>{t('login_subtitle')}</p>
        <p className="login-form-helper">{t('login_helper')}</p>
      </div>

      {error ? (
        <div className="banner banner-danger login-error-banner" role="alert" data-testid="login-error-banner">
          {t('login_failed')}: {error.message ?? String(error)}
        </div>
      ) : null}

      {session?.user ? (
        <div className="login-session-bar">
          <span className="login-session-status">Authenticated: Yes</span>
          <span>{session.user.email}</span>
          <button className="btn btn-outline secondary-button" disabled={busy} onClick={handleSignOut} type="button">
            {t('logout')}
          </button>
        </div>
      ) : (
        <form className="login-form-grid" onSubmit={handleSignIn}>
          <div className="form-group">
            <label className="form-label" htmlFor="staging-login-email">
              {t('login_email_label')}
            </label>
            <input
              autoComplete="email"
              className={`form-control${error ? ' is-invalid' : ''}`}
              data-testid="login-email-input"
              id="staging-login-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="staging-login-password">
              {t('login_password_label')}
            </label>
            <input
              autoComplete="current-password"
              className={`form-control${error ? ' is-invalid' : ''}`}
              data-testid="login-password-input"
              id="staging-login-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </div>
          <div className="form-group login-form-forgot">
            <Link className="auth-text-link" data-testid="forgot-password-link" to="/forgot-password">
              {t('forgot_password_link')}
            </Link>
          </div>
          <div className="form-group login-form-actions">
            <button
              className="btn btn-primary btn-block primary-button"
              data-testid="login-submit-button"
              disabled={busy}
              type="submit"
            >
              {t('login_submit')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default StagingLoginPanel;

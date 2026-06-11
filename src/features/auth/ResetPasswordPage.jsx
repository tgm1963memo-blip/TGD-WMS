import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthPageShell } from '../../components/auth/AuthPageShell.jsx';
import { getStagingSession, subscribeToStagingAuth, updateStagingPassword } from '../../services/stagingAuthService.js';
import { validatePasswordConfirmation, validatePasswordStrength } from '../../utils/authPasswordUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function ResetPasswordPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let active = true;

    getStagingSession().then((result) => {
      if (!active) return;
      setHasRecoverySession(!!result.data?.user);
      setSessionReady(true);
    });

    const subscription = subscribeToStagingAuth((session) => {
      if (!active) return;
      setHasRecoverySession(!!session?.user);
      setSessionReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe?.();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      setError(new Error(t('password_too_short')));
      return;
    }

    const confirmation = validatePasswordConfirmation(password, confirmPassword);
    if (!confirmation.valid) {
      setError(new Error(t('password_mismatch')));
      return;
    }

    setBusy(true);
    const result = await updateStagingPassword(password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 1800);
  }

  return (
    <AuthPageShell testId="reset-password-page">
      <section className="auth-form-panel" data-testid="reset-password-form-panel">
        <div className="login-form-header">
          <h2>{t('reset_password_title')}</h2>
          <p>{t('reset_password_description')}</p>
        </div>

        {!sessionReady ? (
          <p className="auth-muted-text">{t('auth_loading')}</p>
        ) : null}

        {sessionReady && !hasRecoverySession ? (
          <div className="banner banner-danger login-error-banner" role="alert" data-testid="reset-password-invalid-session">
            {t('reset_password_invalid_session')}
            <div style={{ marginTop: 12 }}>
              <Link className="auth-text-link" to="/forgot-password">{t('forgot_password_link')}</Link>
            </div>
          </div>
        ) : null}

        {success ? (
          <div className="banner banner-success auth-success-banner" role="status" data-testid="reset-password-success">
            {t('reset_password_success')}
          </div>
        ) : null}

        {error ? (
          <div className="banner banner-danger login-error-banner" role="alert" data-testid="reset-password-error">
            {error.message ?? String(error)}
          </div>
        ) : null}

        {sessionReady && hasRecoverySession && !success ? (
          <form className="login-form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-password-new">
                {t('reset_password_new_label')}
              </label>
              <input
                autoComplete="new-password"
                className="form-control"
                data-testid="reset-password-new-input"
                id="reset-password-new"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-password-confirm">
                {t('reset_password_confirm_label')}
              </label>
              <input
                autoComplete="new-password"
                className="form-control"
                data-testid="reset-password-confirm-input"
                id="reset-password-confirm"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </div>
            <div className="form-group login-form-actions">
              <button
                className="btn btn-primary btn-block primary-button"
                data-testid="reset-password-submit-button"
                disabled={busy}
                type="submit"
              >
                {t('reset_password_submit')}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </AuthPageShell>
  );
}

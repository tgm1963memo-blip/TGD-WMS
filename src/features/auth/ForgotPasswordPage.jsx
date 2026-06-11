import { useState } from 'react';
import { requestPasswordReset } from '../../services/stagingAuthService.js';
import { AuthPageShell } from '../../components/auth/AuthPageShell.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

export function ForgotPasswordPage() {
  const t = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isValidEmail(email)) {
      setError(new Error(t('forgot_password_invalid_email')));
      return;
    }

    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);

    if (result.error?.message?.includes('Supabase client is not configured')) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  }

  return (
    <AuthPageShell testId="forgot-password-page" showBackToLogin>
      <section className="auth-form-panel" data-testid="forgot-password-form-panel">
        <div className="login-form-header">
          <h2>{t('forgot_password_title')}</h2>
          <p>{t('forgot_password_description')}</p>
        </div>

        {success ? (
          <div className="banner banner-success auth-success-banner" role="status" data-testid="forgot-password-success">
            {t('forgot_password_success')}
          </div>
        ) : null}

        {error ? (
          <div className="banner banner-danger login-error-banner" role="alert" data-testid="forgot-password-error">
            {error.message ?? String(error)}
          </div>
        ) : null}

        <form className="login-form-grid" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="forgot-password-email">
              {t('login_email_label')}
            </label>
            <input
              autoComplete="email"
              className={`form-control${error ? ' is-invalid' : ''}`}
              data-testid="forgot-password-email-input"
              id="forgot-password-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              type="email"
              value={email}
            />
          </div>
          <div className="form-group login-form-actions">
            <button
              className="btn btn-primary btn-block primary-button"
              data-testid="forgot-password-submit-button"
              disabled={busy}
              type="submit"
            >
              {t('forgot_password_submit')}
            </button>
          </div>
        </form>
      </section>
    </AuthPageShell>
  );
}

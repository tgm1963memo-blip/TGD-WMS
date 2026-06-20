import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthPageShell } from '../../components/auth/AuthPageShell.jsx';
import { subscribeToAuthEvents, updateStagingPassword, verifyRecoveryToken } from '../../services/stagingAuthService.js';
import { validatePasswordConfirmation, validatePasswordStrength } from '../../utils/authPasswordUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

// Events that indicate a valid recovery session is present.
const RECOVERY_EVENTS = new Set(['PASSWORD_RECOVERY', 'INITIAL_SESSION', 'SIGNED_IN']);

export function ResetPasswordPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const resolved = useRef(false);

  useEffect(() => {
    let active = true;

    const tokenHash = searchParams.get('token_hash');
    const tokenType = searchParams.get('type');

    // If the link came from our custom SMTP email (token_hash in URL), exchange it for
    // a session directly — bypasses Supabase's server-side redirect which would use
    // the Dashboard "Site URL" (often localhost in dev).
    if (tokenHash && tokenType === 'recovery') {
      verifyRecoveryToken(tokenHash).then(({ data: session, error: verifyError }) => {
        if (!active || resolved.current) return;
        resolved.current = true;
        if (verifyError || !session?.user) {
          setHasRecoverySession(false);
        } else {
          setHasRecoverySession(true);
        }
        setSessionReady(true);
      });
      return () => { active = false; };
    }

    // Standard Supabase hash-based flow (action_link click → session in URL hash).
    // INITIAL_SESSION fires on subscription with the current auth state.
    const subscription = subscribeToAuthEvents((event, session) => {
      if (!active) return;

      if (RECOVERY_EVENTS.has(event)) {
        if (!resolved.current) {
          resolved.current = true;
          setHasRecoverySession(!!session?.user);
          setSessionReady(true);
        } else if (event === 'PASSWORD_RECOVERY' && session?.user) {
          setHasRecoverySession(true);
        }
      }
    });

    const timer = setTimeout(() => {
      if (!active || resolved.current) return;
      resolved.current = true;
      setHasRecoverySession(false);
      setSessionReady(true);
    }, 4000);

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.unsubscribe?.();
    };
  }, [searchParams]);

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
          <p className="auth-muted-text" data-testid="reset-password-loading">
            {t('auth_loading')}
          </p>
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

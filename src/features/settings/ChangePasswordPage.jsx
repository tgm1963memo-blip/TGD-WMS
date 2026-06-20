import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { updateStagingPassword } from '../../services/stagingAuthService.js';
import { validatePasswordConfirmation, validatePasswordStrength } from '../../utils/authPasswordUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function ChangePasswordPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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
      navigate('/settings/profile', { replace: true });
    }, 1800);
  }

  return (
    <section className={getPageShellClassName()} data-testid="change-password-page">
      <PageHeader
        title={t('change_password_page_title')}
        description={t('change_password_page_description')}
      />

      <div className="profile-settings-grid">
        <div className="section-card profile-settings-card" data-testid="change-password-card">
          {success ? (
            <div className="banner banner-success" role="status" data-testid="change-password-success">
              {t('change_password_success')}
            </div>
          ) : null}

          {error ? (
            <div className="banner banner-danger" role="alert" data-testid="change-password-error">
              {error.message ?? String(error)}
            </div>
          ) : null}

          {!success ? (
            <form className="login-form-grid" noValidate onSubmit={handleSubmit} data-testid="change-password-form">
              <div className="form-group">
                <label className="form-label" htmlFor="change-password-new">
                  {t('reset_password_new_label')}
                </label>
                <input
                  autoComplete="new-password"
                  className="form-control"
                  data-testid="change-password-new-input"
                  id="change-password-new"
                  minLength={8}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="change-password-confirm">
                  {t('reset_password_confirm_label')}
                </label>
                <input
                  autoComplete="new-password"
                  className="form-control"
                  data-testid="change-password-confirm-input"
                  id="change-password-confirm"
                  minLength={8}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </div>
              <div className="form-group" style={{ marginTop: '0.25rem' }}>
                <p className="section-card-description" style={{ marginBottom: '0.75rem' }}>
                  {t('change_password_hint')}
                </p>
              </div>
              <div className="form-group login-form-actions">
                <button
                  className="btn btn-primary btn-block primary-button"
                  data-testid="change-password-submit-button"
                  disabled={busy}
                  type="submit"
                >
                  {t('change_password_submit')}
                </button>
              </div>
            </form>
          ) : null}

          <div style={{ marginTop: '1rem' }}>
            <Link className="btn btn-outline" data-testid="change-password-back-link" to="/settings/profile">
              {t('change_password_back_to_profile')}
            </Link>
          </div>
        </div>

        <div className="section-card profile-settings-card" data-testid="change-password-info-card">
          <h3 className="section-card-title">{t('change_password_forgot_title')}</h3>
          <p className="section-card-description">{t('change_password_forgot_description')}</p>
          <Link
            className="btn btn-outline"
            data-testid="change-password-forgot-link"
            to="/forgot-password"
          >
            {t('change_password_forgot_action')}
          </Link>
        </div>
      </div>
    </section>
  );
}

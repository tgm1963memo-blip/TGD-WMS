import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { requestPasswordReset } from '../../services/stagingAuthService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import {
  RESET_PASSWORD_EMAIL_TEMPLATE,
  RESET_PASSWORD_EMAIL_SUBJECT,
} from './emailResetTemplate.js';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

export function EmailSettingsPage() {
  const t = useTranslation();
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null); // 'subject' | 'body' | null
  const [templateOpen, setTemplateOpen] = useState(false);

  async function handleTestEmail(event) {
    event.preventDefault();
    setResult(null);

    if (!isValidEmail(testEmail)) {
      setResult({ success: false, message: t('forgot_password_invalid_email') });
      return;
    }

    setBusy(true);
    const res = await requestPasswordReset(testEmail);
    setBusy(false);

    if (res.error) {
      setResult({ success: false, message: res.error.message ?? String(res.error) });
    } else {
      setResult({ success: true, message: t('email_settings_test_sent_success') });
    }
  }

  function handleCopy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <section className={getPageShellClassName()} data-testid="email-settings-page">
      <PageHeader
        title={t('email_settings_title')}
        description={t('email_settings_description')}
      />

      <div className="profile-settings-grid">

        {/* ── Test email card ───────────────────────────────── */}
        <div className="section-card profile-settings-card" data-testid="email-settings-test-card">
          <h3 className="section-card-title">{t('email_settings_test_title')}</h3>
          <p className="section-card-description">{t('email_settings_test_description')}</p>

          {result ? (
            <div
              className={`banner ${result.success ? 'banner-success' : 'banner-danger'}`}
              role={result.success ? 'status' : 'alert'}
              data-testid="email-settings-test-result"
            >
              {result.message}
            </div>
          ) : null}

          <form className="login-form-grid" noValidate onSubmit={handleTestEmail} data-testid="email-settings-test-form">
            <div className="form-group">
              <label className="form-label" htmlFor="test-email-input">
                {t('email_settings_test_email_label')}
              </label>
              <input
                autoComplete="email"
                className="form-control"
                data-testid="email-settings-test-email-input"
                id="test-email-input"
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="name@company.com"
                type="email"
                value={testEmail}
              />
            </div>
            <div className="form-group login-form-actions">
              <button
                className="btn btn-primary"
                data-testid="email-settings-test-send-button"
                disabled={busy}
                type="submit"
              >
                {busy ? t('email_settings_test_sending') : t('email_settings_test_send')}
              </button>
            </div>
          </form>
        </div>

        {/* ── SMTP guide card ───────────────────────────────── */}
        <div className="section-card profile-settings-card" data-testid="email-settings-smtp-guide-card">
          <h3 className="section-card-title">{t('email_settings_smtp_guide_title')}</h3>
          <p className="section-card-description">{t('email_settings_smtp_guide_description')}</p>

          <ol className="email-settings-guide-steps">
            <li>{t('email_settings_smtp_step1')}</li>
            <li>{t('email_settings_smtp_step2')}</li>
            <li>{t('email_settings_smtp_step3')}</li>
            <li>{t('email_settings_smtp_step4')}</li>
          </ol>

          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--tgd-text, #09090b)' }}>
              {t('email_settings_smtp_reference_values')}
            </h4>
            <dl className="profile-settings-dl">
              <div>
                <dt>{t('email_settings_smtp_sender_email')}</dt>
                <dd><code>noreply.ememo@tgm.co.th</code></dd>
              </div>
              <div>
                <dt>{t('email_settings_smtp_sender_name')}</dt>
                <dd><code>TG Cold Storage WMS</code></dd>
              </div>
              <div>
                <dt>{t('email_settings_smtp_port')}</dt>
                <dd><code>587</code></dd>
              </div>
              <div>
                <dt>{t('email_settings_smtp_security')}</dt>
                <dd><code>STARTTLS</code></dd>
              </div>
            </dl>
          </div>
        </div>

      </div>

      {/* ── Email template section (full width) ─────────────── */}
      <div className="section-card" style={{ marginTop: '1.5rem' }} data-testid="email-settings-template-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 className="section-card-title" style={{ marginBottom: '0.25rem' }}>
              {t('email_settings_template_title')}
            </h3>
            <p className="section-card-description" style={{ margin: 0 }}>
              {t('email_settings_template_description')}
            </p>
          </div>
          <button
            className="btn btn-outline"
            onClick={() => setTemplateOpen((v) => !v)}
            type="button"
          >
            {templateOpen ? t('email_settings_template_hide') : t('email_settings_template_show')}
          </button>
        </div>

        {templateOpen ? (
          <div style={{ marginTop: '1.25rem' }}>
            {/* Subject line */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--tgd-muted-text, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('email_settings_template_subject')}
                </span>
                <button
                  className="btn btn-outline"
                  onClick={() => handleCopy(RESET_PASSWORD_EMAIL_SUBJECT, 'subject')}
                  style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                  type="button"
                >
                  {copied === 'subject' ? t('email_settings_template_copied') : t('email_settings_template_copy')}
                </button>
              </div>
              <div style={{ background: 'var(--tgd-surface-subtle, #f4f5f7)', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--tgd-text, #09090b)' }}>
                {RESET_PASSWORD_EMAIL_SUBJECT}
              </div>
            </div>

            {/* HTML body */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--tgd-muted-text, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('email_settings_template_body')}
                </span>
                <button
                  className="btn btn-outline"
                  onClick={() => handleCopy(RESET_PASSWORD_EMAIL_TEMPLATE, 'body')}
                  style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                  type="button"
                >
                  {copied === 'body' ? t('email_settings_template_copied') : t('email_settings_template_copy')}
                </button>
              </div>
              <pre
                data-testid="email-settings-template-preview"
                style={{
                  background: 'var(--tgd-surface-subtle, #f4f5f7)',
                  borderRadius: '6px',
                  padding: '14px 16px',
                  fontSize: '0.72rem',
                  lineHeight: '1.55',
                  overflowX: 'auto',
                  maxHeight: '360px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--tgd-text, #09090b)',
                  margin: 0,
                  fontFamily: 'monospace',
                }}
              >
                {RESET_PASSWORD_EMAIL_TEMPLATE}
              </pre>
            </div>

            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--tgd-muted-text, #6b7280)' }}>
              {t('email_settings_template_paste_hint')}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

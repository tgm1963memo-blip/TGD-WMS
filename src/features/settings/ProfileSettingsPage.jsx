import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

function formatCustomerScope(customerId, t) {
  if (!customerId) return t('profile_global_scope');
  return customerId;
}

export function ProfileSettingsPage() {
  const { session } = useAuth();
  const t = useTranslation();
  const [state, setState] = useState({ profile: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getCurrentUserProfile().then((result) => {
      if (!active) return;
      setState({
        profile: result.data ?? null,
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (state.loading) {
    return (
      <section className="page-shell profile-settings-page" data-testid="profile-settings-page">
        <LoadingState />
      </section>
    );
  }

  const profile = state.profile;

  return (
    <section className="page-shell profile-settings-page" data-testid="profile-settings-page">
      <PageHeader
        title={t('profile_settings_title')}
        description={t('profile_settings_description')}
      />

      {state.error ? (
        <div className="banner banner-danger" role="alert" data-testid="profile-settings-error">
          {state.error.message ?? String(state.error)}
        </div>
      ) : null}

      <div className="profile-settings-grid">
        <div className="section-card profile-settings-card" data-testid="profile-settings-summary">
          <h3 className="section-card-title">{t('profile_settings_title')}</h3>
          <dl className="profile-settings-dl">
            <div>
              <dt>{t('profile_email')}</dt>
              <dd data-testid="profile-settings-email">{session?.user?.email ?? '-'}</dd>
            </div>
            <div>
              <dt>{t('profile_role')}</dt>
              <dd data-testid="profile-settings-role">{profile?.role ?? t('profile_not_linked')}</dd>
            </div>
            <div>
              <dt>{t('profile_active_status')}</dt>
              <dd data-testid="profile-settings-active">
                {profile?.is_active ? t('profile_active_yes') : t('profile_active_no')}
              </dd>
            </div>
            <div>
              <dt>{t('profile_customer_scope')}</dt>
              <dd data-testid="profile-settings-customer-scope">
                {formatCustomerScope(profile?.customer_id, t)}
              </dd>
            </div>
            <div>
              <dt>{t('profile_display_name')}</dt>
              <dd data-testid="profile-settings-display-name">{profile?.display_name ?? '-'}</dd>
            </div>
          </dl>
        </div>

        <div className="section-card profile-settings-card" data-testid="profile-change-password-card">
          <h3 className="section-card-title">{t('change_password_title')}</h3>
          <p className="section-card-description">{t('change_password_description')}</p>
          <Link
            className="btn btn-outline"
            data-testid="profile-change-password-link"
            to="/settings/change-password"
          >
            {t('change_password_action')}
          </Link>
        </div>
      </div>
    </section>
  );
}

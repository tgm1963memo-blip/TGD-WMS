import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { getCurrentUserProfile, updateOwnProfile } from '../../services/userProfileService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

function formatCustomerScope(customerId, t) {
  if (!customerId) return t('profile_global_scope');
  return customerId;
}

export function ProfileSettingsPage() {
  const { session } = useAuth();
  const t = useTranslation();
  const [state, setState] = useState({ profile: null, loading: true, error: null });
  const [form, setForm] = useState({ firstName: '', lastName: '', pinCode: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    setState((cur) => ({ ...cur, loading: true, error: null }));
    getCurrentUserProfile(session?.user?.id).then((result) => {
      if (!active) return;
      const p = result.data ?? null;
      setState({ profile: p, loading: false, error: result.error ?? null });
      if (p) {
        setForm({
          firstName: p.first_name ?? '',
          lastName:  p.last_name  ?? '',
          pinCode:   p.pin_code   ?? '',
        });
      }
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    const result = await updateOwnProfile({
      firstName:   form.firstName  || null,
      lastName:    form.lastName   || null,
      pinCode:     form.pinCode    || null,
    });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error.message ?? 'บันทึกไม่สำเร็จ');
    } else {
      setSaveMsg('บันทึกข้อมูลสำเร็จ');
      setState((cur) => ({
        ...cur,
        profile: cur.profile ? {
          ...cur.profile,
          first_name:   form.firstName || cur.profile.first_name,
          last_name:    form.lastName  || cur.profile.last_name,
          display_name: [form.firstName, form.lastName].filter(Boolean).join(' ') || cur.profile.display_name,
          pin_code:     form.pinCode   || cur.profile.pin_code,
        } : cur.profile,
      }));
    }
  }

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
        {/* Read-only summary */}
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

        {/* Editable fields */}
        <div className="section-card profile-settings-card" data-testid="profile-edit-card">
          <h3 className="section-card-title">{'แก้ไขข้อมูลส่วนตัว'}</h3>
          {saveMsg ? <div className="alert-success-panel" role="status">{saveMsg}</div> : null}
          {saveError ? <div className="banner banner-danger" role="alert">{saveError}</div> : null}
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <label className="form-field">
                <span>{'ชื่อ'}</span>
                <input
                  className="form-control"
                  placeholder="ชื่อจริง"
                  value={form.firstName}
                  onChange={(e) => { setForm((f) => ({ ...f, firstName: e.target.value })); setSaveMsg(''); }}
                />
              </label>
              <label className="form-field">
                <span>{'นามสกุล'}</span>
                <input
                  className="form-control"
                  placeholder="นามสกุล"
                  value={form.lastName}
                  onChange={(e) => { setForm((f) => ({ ...f, lastName: e.target.value })); setSaveMsg(''); }}
                />
              </label>
              <label className="form-field">
                <span>{'รหัส PIN (Handheld)'}</span>
                <input
                  className="form-control"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="e.g. 1234"
                  value={form.pinCode}
                  onChange={(e) => { setForm((f) => ({ ...f, pinCode: e.target.value })); setSaveMsg(''); }}
                />
              </label>
            </div>
            <div className="action-row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled={saving} type="submit">
                {saving ? 'กำลังบันทึก...' : t('save')}
              </button>
            </div>
          </form>
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

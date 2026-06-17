import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getCustomers } from '../../services/masterDataService.js';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import {
  ALL_ASSIGNABLE_ROLES,
  CUSTOMER_PORTAL_ROLES,
  createAuthUser,
  getUserProfiles,
  setUserProfileActive,
  upsertUserProfile,
} from '../../services/userManagementService.js';
import { canManageUsers } from '../../security/userManagementPermissions.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const EMPTY_FORM = {
  profileId: '',
  email: '',
  displayName: '',
  password: '',
  role: 'warehouse_staff',
  customerId: '',
  authUserId: '',
  isActive: true,
};

export function UserManagementPage() {
  const t = useTranslation();
  const [profiles, setProfiles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canManage, setCanManage] = useState(false);

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((row) => [row.id, row.customer_name ?? row.customer_code])),
    [customers],
  );

  const columns = [
    { key: 'email', header: t('user_mgmt_col_email') },
    { key: 'display_name', header: t('user_mgmt_col_display_name') },
    { key: 'role', header: t('user_mgmt_col_role') },
    {
      key: 'customer_id',
      header: t('user_mgmt_col_customer'),
      render: (row) => (row.customer_id ? customerMap[row.customer_id] ?? row.customer_id : '-'),
    },
    {
      key: 'auth_user_id',
      header: t('user_mgmt_col_auth_user'),
      render: (row) => (row.auth_user_id ? 'Linked' : t('user_mgmt_auth_pending')),
    },
    { key: 'is_active', header: t('user_mgmt_col_status'), render: (row) => <StatusBadge value={row.is_active} /> },
    {
      key: 'actions',
      header: t('user_mgmt_col_actions'),
      render: (row) => (
        <div className="action-row">
          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(row)} type="button">
            {t('edit')}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={saving}
            onClick={() => toggleActive(row)}
            type="button"
          >
            {row.is_active ? t('user_mgmt_deactivate') : t('user_mgmt_activate')}
          </button>
        </div>
      ),
    },
  ];

  async function loadData() {
    setLoading(true);
    setError('');

    const [profileResult, userResult, customerResult] = await Promise.all([
      getCurrentUserProfile(),
      getUserProfiles(),
      getCustomers(),
    ]);

    const role = profileResult.data?.role ?? '';
    setCanManage(canManageUsers(role));

    if (userResult.error) {
      setError(userResult.error.message ?? t('user_mgmt_load_error'));
      setProfiles([]);
    } else {
      setProfiles(userResult.data ?? []);
    }

    setCustomers(customerResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function startCreate() {
    setForm(EMPTY_FORM);
    setSuccess('');
    setError('');
  }

  function startEdit(row) {
    setForm({
      profileId: row.id,
      email: row.email ?? '',
      displayName: row.display_name ?? '',
      password: '',
      role: row.role ?? 'warehouse_staff',
      customerId: row.customer_id ?? '',
      authUserId: row.auth_user_id ?? '',
      isActive: row.is_active !== false,
    });
    setSuccess('');
    setError('');
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    let authUserId = form.authUserId || null;

    if (!form.profileId) {
      if (!form.password || form.password.length < 8) {
        setSaving(false);
        setError(t('user_mgmt_password_required'));
        return;
      }

      const authResult = await createAuthUser({
        email: form.email,
        password: form.password,
      });

      if (authResult.error) {
        setSaving(false);
        setError(authResult.error.message ?? t('user_mgmt_auth_create_error'));
        return;
      }

      authUserId = authResult.data?.authUserId ?? null;
    }

    const result = await upsertUserProfile({
      profileId: form.profileId || null,
      email: form.email,
      displayName: form.displayName,
      role: form.role,
      customerId: CUSTOMER_PORTAL_ROLES.includes(form.role) ? form.customerId || null : null,
      authUserId,
      isActive: form.isActive,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error.message ?? t('user_mgmt_save_error'));
      return;
    }

    setSuccess(t('user_mgmt_save_success'));
    setForm(EMPTY_FORM);
    await loadData();
  }

  async function toggleActive(row) {
    setSaving(true);
    setError('');
    setSuccess('');

    const result = await setUserProfileActive(row.id, !row.is_active);
    setSaving(false);

    if (result.error) {
      setError(result.error.message ?? t('user_mgmt_save_error'));
      return;
    }

    setSuccess(t('user_mgmt_save_success'));
    await loadData();
  }

  if (!loading && !canManage) {
    return (
      <section className="page-shell" data-testid="user-management-page">
        <PageHeader title={t('user_mgmt_title')} description={t('user_mgmt_description')} />
        <div className="banner banner-warning" role="status">{t('user_mgmt_admin_only')}</div>
      </section>
    );
  }

  return (
    <section className="page-shell" data-testid="user-management-page">
      <PageHeader
        title={t('user_mgmt_title')}
        description={t('user_mgmt_description')}
        actions={(
          <button className="btn btn-primary" data-testid="user-mgmt-create-button" onClick={startCreate} type="button">
            {t('user_mgmt_create')}
          </button>
        )}
      />

      <div className="banner banner-info" role="note">{t('user_mgmt_auth_note')}</div>

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}

      <form className="form-card" data-testid="user-management-form" onSubmit={handleSubmit}>
        <h3>{form.profileId ? t('user_mgmt_edit_title') : t('user_mgmt_create_title')}</h3>
        <div className="form-grid">
          <label className="form-field">
            <span>{t('user_mgmt_col_email')}</span>
            <input
              className="form-control"
              data-testid="user-mgmt-email"
              disabled={Boolean(form.profileId)}
              onChange={(e) => updateField('email', e.target.value)}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label className="form-field">
            <span>{t('user_mgmt_col_display_name')}</span>
            <input
              className="form-control"
              onChange={(e) => updateField('displayName', e.target.value)}
              value={form.displayName}
            />
          </label>
          {!form.profileId ? (
            <label className="form-field">
              <span>{t('user_mgmt_col_password')}</span>
              <input
                className="form-control"
                data-testid="user-mgmt-password"
                minLength={8}
                onChange={(e) => updateField('password', e.target.value)}
                required
                type="password"
                value={form.password}
              />
            </label>
          ) : null}
          <label className="form-field">
            <span>{t('user_mgmt_col_role')}</span>
            <select
              className="form-control"
              data-testid="user-mgmt-role"
              onChange={(e) => updateField('role', e.target.value)}
              required
              value={form.role}
            >
              {ALL_ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          {CUSTOMER_PORTAL_ROLES.includes(form.role) ? (
            <label className="form-field">
              <span>{t('user_mgmt_col_customer')}</span>
              <select
                className="form-control"
                data-testid="user-mgmt-customer"
                onChange={(e) => updateField('customerId', e.target.value)}
                required
                value={form.customerId}
              >
                <option value="">{t('user_mgmt_select_customer')}</option>
                {customers.map((row) => (
                  <option key={row.id} value={row.id}>{row.customer_code} — {row.customer_name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {form.profileId ? (
            <label className="form-field form-field-span-2">
              <span>{t('user_mgmt_col_auth_user')}</span>
              <input
                className="form-control"
                data-testid="user-mgmt-auth-user-id"
                disabled
                readOnly
                value={form.authUserId || t('user_mgmt_auth_pending')}
              />
            </label>
          ) : null}
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={startCreate} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="user-mgmt-save-button" disabled={saving} type="submit">
            {saving ? t('user_mgmt_saving') : t('save')}
          </button>
        </div>
      </form>

      <DataTable
        columns={columns}
        data={profiles}
        emptyMessage={t('user_mgmt_empty')}
        error={null}
        loading={loading}
        testId="user-management-table"
      />
    </section>
  );
}

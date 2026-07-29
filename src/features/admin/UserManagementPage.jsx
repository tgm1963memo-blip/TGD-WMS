import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getCustomers } from '../../services/masterDataService.js';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import {
  ALL_ASSIGNABLE_ROLES,
  CUSTOMER_PORTAL_ROLES,
  createAuthUser,
  deleteUserProfile,
  getUserProfiles,
  resetUserPassword,
  setUserProfileActive,
  upsertUserProfile,
} from '../../services/userManagementService.js';
import { canManageUsers } from '../../security/userManagementPermissions.js';
import { useTranslation, useLanguage } from '../../i18n/languageProvider.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { listCustomerCustomRoles } from '../../services/customerCustomRoleService.js';

const EMPTY_FORM = {
  profileId: '',
  email: '',
  firstName: '',
  lastName: '',
  displayName: '',
  password: '',
  role: 'warehouse_staff',
  customerId: '',
  customerCustomRoleId: '',
  authUserId: '',
  pinCode: '',
  isActive: true,
};

export function UserManagementPage() {
  const { session } = useAuth();
  const t = useTranslation();
  const { language } = useLanguage();
  const [profiles, setProfiles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [resetRow, setResetRow] = useState(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetting, setResetting] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [customRoles, setCustomRoles] = useState([]);

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((row) => [row.id, row.customer_name ?? row.customer_code])),
    [customers],
  );

  const columns = [
    { key: 'email', header: t('user_mgmt_col_email'), truncate: true },
    { key: 'display_name', header: t('user_mgmt_col_display_name'), truncate: true },
    { key: 'role', header: t('user_mgmt_col_role'), truncate: true },
    {
      key: 'customer_id',
      header: t('user_mgmt_col_customer'),
      truncate: true,
      render: (row) => (row.customer_id ? customerMap[row.customer_id] ?? row.customer_id : '-'),
    },
    {
      key: 'customer_custom_role',
      header: language === 'th' ? 'บทบาทที่กำหนดเอง' : 'Custom Role',
      truncate: true,
      render: (row) => (row.role === 'customer_user' ? (row.customer_custom_role?.role_name ?? '-') : '-'),
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
        <div className="action-row action-row--compact">
          <button
            className="btn btn-secondary icon-btn"
            onClick={() => startEdit(row)}
            title={t('edit')}
            aria-label={t('edit')}
            type="button"
          >
            ✎
          </button>
          {row.auth_user_id ? (
            <button
              className="btn btn-secondary icon-btn"
              disabled={saving || resetting}
              onClick={() => { setResetRow(row); setResetPwd(''); setError(''); setSuccess(''); }}
              title="รีเซตรหัสผ่าน"
              aria-label="รีเซตรหัสผ่าน"
              type="button"
            >
              🔑
            </button>
          ) : null}
          <button
            className="btn btn-secondary icon-btn"
            disabled={saving}
            onClick={() => toggleActive(row)}
            title={row.is_active ? t('user_mgmt_deactivate') : t('user_mgmt_activate')}
            aria-label={row.is_active ? t('user_mgmt_deactivate') : t('user_mgmt_activate')}
            type="button"
          >
            {row.is_active ? '⏸' : '▶'}
          </button>
          <button
            className="btn btn-danger icon-btn"
            disabled={saving}
            onClick={() => { setDeleteRow(row); setError(''); setSuccess(''); }}
            title="ลบผู้ใช้"
            aria-label="ลบผู้ใช้"
            type="button"
          >
            🗑
          </button>
        </div>
      ),
    },
  ];

  async function loadData() {
    setLoading(true);
    setError('');

    const [profileResult, userResult, customerResult] = await Promise.all([
      getCurrentUserProfile(session?.user?.id),
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

  useEffect(() => {
    if (!isFormOpen || form.role !== 'customer_user' || !form.customerId) {
      setCustomRoles([]);
      return undefined;
    }
    let cancelled = false;
    listCustomerCustomRoles(form.customerId).then((result) => {
      if (!cancelled) setCustomRoles(result.data ?? []);
    });
    return () => { cancelled = true; };
  }, [isFormOpen, form.role, form.customerId]);

  function startCreate() {
    setForm(EMPTY_FORM);
    setSuccess('');
    setError('');
    setIsFormOpen(true);
  }

  function startEdit(row) {
    setForm({
      profileId: row.id,
      email: row.email ?? '',
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      displayName: row.display_name ?? '',
      password: '',
      role: row.role ?? 'warehouse_staff',
      customerId: row.customer_id ?? '',
      customerCustomRoleId: row.customer_custom_role_id ?? '',
      authUserId: row.auth_user_id ?? '',
      pinCode: row.pin_code ?? '',
      isActive: row.is_active !== false,
    });
    setSuccess('');
    setError('');
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(EMPTY_FORM);
    setError('');
    setSuccess('');
  }

  function closeResetModal() {
    setResetRow(null);
    setResetPwd('');
    setError('');
  }

  function closeDeleteModal() {
    setDeleteRow(null);
    setError('');
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess('');
    setError('');
  }

  function updateRole(role) {
    setForm((current) => ({
      ...current,
      role,
      customerCustomRoleId: role === 'customer_user' ? current.customerCustomRoleId : '',
    }));
    setSuccess('');
    setError('');
  }

  function updateCustomerId(customerId) {
    setForm((current) => ({ ...current, customerId, customerCustomRoleId: '' }));
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
      profileId:   form.profileId  || null,
      email:       form.email,
      firstName:   form.firstName  || null,
      lastName:    form.lastName   || null,
      displayName: form.displayName || null,
      role:        form.role,
      customerId:  CUSTOMER_PORTAL_ROLES.includes(form.role) ? form.customerId || null : null,
      customerCustomRoleId: form.role === 'customer_user' ? form.customerCustomRoleId || null : null,
      authUserId,
      pinCode:     form.pinCode    || null,
      isActive:    form.isActive,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error.message ?? t('user_mgmt_save_error'));
      return;
    }

    setSuccess(t('user_mgmt_save_success'));
    setForm(EMPTY_FORM);
    setIsFormOpen(false);
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

  async function handleResetPassword(event) {
    event.preventDefault();
    if (!resetRow?.email || !resetPwd || resetPwd.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setResetting(true);
    setError('');
    setSuccess('');
    const result = await resetUserPassword(resetRow.email, resetPwd);
    setResetting(false);
    if (result.error) {
      setError(result.error.message ?? 'รีเซตรหัสผ่านไม่สำเร็จ');
      return;
    }
    setSuccess(`รีเซตรหัสผ่านสำเร็จสำหรับ ${resetRow.email}`);
    setResetRow(null);
    setResetPwd('');
  }

  async function handleDeleteUser() {
    if (!deleteRow) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    const result = await deleteUserProfile(deleteRow.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error.message ?? 'ลบผู้ใช้ไม่สำเร็จ');
      return;
    }
    setSuccess(`ลบผู้ใช้ ${deleteRow.email} แล้ว — ประวัติการทำงานยังถูกเก็บไว้`);
    setDeleteRow(null);
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

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={form.profileId ? t('user_mgmt_edit_title') : t('user_mgmt_create_title')}
        size="lg"
      >
      <form data-testid="user-management-form" onSubmit={handleSubmit}>
        {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}
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
            <span>{language === 'th' ? 'ชื่อ' : 'First Name'}</span>
            <input
              className="form-control"
              onChange={(e) => updateField('firstName', e.target.value)}
              placeholder={language === 'th' ? 'ชื่อจริง' : 'First name'}
              value={form.firstName}
            />
          </label>
          <label className="form-field">
            <span>{language === 'th' ? 'นามสกุล' : 'Last Name'}</span>
            <input
              className="form-control"
              onChange={(e) => updateField('lastName', e.target.value)}
              placeholder={language === 'th' ? 'นามสกุล' : 'Last name'}
              value={form.lastName}
            />
          </label>
          <label className="form-field">
            <span>{language === 'th' ? 'รหัส PIN (Handheld)' : 'Handheld PIN'}</span>
            <input
              className="form-control"
              type="text"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="e.g. 1234"
              onChange={(e) => updateField('pinCode', e.target.value)}
              value={form.pinCode}
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
              onChange={(e) => updateRole(e.target.value)}
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
                onChange={(e) => updateCustomerId(e.target.value)}
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
          {form.role === 'customer_user' && form.customerId ? (
            <label className="form-field">
              <span>{language === 'th' ? 'บทบาทที่กำหนดเอง (จำกัดเมนู)' : 'Custom Role (menu restriction)'}</span>
              <select
                className="form-control"
                data-testid="user-mgmt-custom-role"
                onChange={(e) => updateField('customerCustomRoleId', e.target.value)}
                value={form.customerCustomRoleId}
              >
                <option value="">{language === 'th' ? 'ไม่จำกัด (เข้าถึงได้ทุกเมนู)' : 'Unrestricted (all menus)'}</option>
                {customRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.role_name}</option>
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
          <button className="btn btn-secondary" onClick={closeForm} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="user-mgmt-save-button" disabled={saving} type="submit">
            {saving ? t('user_mgmt_saving') : t('save')}
          </button>
        </div>
      </form>
      </Modal>

      <Modal isOpen={Boolean(resetRow)} onClose={closeResetModal} title="รีเซตรหัสผ่าน" size="sm">
        <form onSubmit={handleResetPassword}>
          {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}
          <p className="form-helper">{'ผู้ใช้: '}<strong>{resetRow?.email}</strong></p>
          <div className="form-grid">
            <label className="form-field">
              <span>{'รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)'}</span>
              <input
                autoFocus
                className="form-control"
                minLength={8}
                onChange={(e) => setResetPwd(e.target.value)}
                required
                type="password"
                value={resetPwd}
              />
            </label>
          </div>
          <div className="action-row">
            <button className="btn btn-secondary" onClick={closeResetModal} type="button">{t('close')}</button>
            <button className="btn btn-primary" disabled={resetting} type="submit">
              {resetting ? 'กำลังรีเซต...' : 'ยืนยันรีเซตรหัสผ่าน'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(deleteRow)} onClose={closeDeleteModal} title="ลบผู้ใช้" size="sm">
        {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}
        <p>{'ยืนยันลบผู้ใช้ '}<strong>{deleteRow?.email}</strong>{' ?'}</p>
        <p className="form-helper">
          ผู้ใช้จะถูกปิดใช้งานและซ่อนออกจากรายการ แต่ประวัติการทำงานทั้งหมดของผู้ใช้นี้จะยังถูกเก็บไว้ในระบบ
        </p>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={closeDeleteModal} type="button">{t('close')}</button>
          <button className="btn btn-danger" disabled={deleting} onClick={handleDeleteUser} type="button">
            {deleting ? 'กำลังลบ...' : 'ยืนยันลบผู้ใช้'}
          </button>
        </div>
      </Modal>

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

import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { navigationGroups } from '../../app/navigation.js';
import {
  listCustomerCustomRoles,
  upsertCustomerCustomRole,
  deleteCustomerCustomRole,
  listCustomerTeamUsers,
  assignCustomerUserCustomRole,
} from '../../services/customerCustomRoleService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';

// The customer-portal menu items a role's checklist can restrict — every
// navigationGroups item under the Customer Portal group except this page
// itself (role management always stays customer_admin-only, restricting
// it for a customer_user would be meaningless since they can never reach
// it regardless — see routePermissionCatalog's minimum_role on this route).
const CUSTOMER_PORTAL_GROUP = navigationGroups.find((g) => g.key === 'customer_portal');
const MENU_KEY_OPTIONS = (CUSTOMER_PORTAL_GROUP?.items ?? [])
  .filter((item) => item.key !== 'customer_team_roles')
  .map((item) => ({ key: item.key, label: item.label }));

const EMPTY_ROLE_FORM = { roleId: null, roleName: '', allowedMenuKeys: [], isActive: true };

export function CustomerTeamRolesPage() {
  const { customerId, role, loading: profileLoading } = useCustomerPortalProfile();
  const [roles, setRoles] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    if (!customerId) { setLoading(false); return; }
    setLoading(true);
    const [rolesResult, usersResult] = await Promise.all([
      listCustomerCustomRoles(customerId),
      listCustomerTeamUsers(),
    ]);
    setRoles(rolesResult.data ?? []);
    setTeamUsers(usersResult.data ?? []);
    setError(rolesResult.error?.message ?? usersResult.error?.message ?? '');
    setLoading(false);
  }

  useEffect(() => {
    if (profileLoading) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, profileLoading]);

  function toggleMenuKey(key) {
    setRoleForm((current) => ({
      ...current,
      allowedMenuKeys: current.allowedMenuKeys.includes(key)
        ? current.allowedMenuKeys.filter((k) => k !== key)
        : [...current.allowedMenuKeys, key],
    }));
  }

  function startEdit(r) {
    setRoleForm({ roleId: r.id, roleName: r.role_name, allowedMenuKeys: r.allowed_menu_keys ?? [], isActive: r.is_active });
    setSuccess('');
    setError('');
  }

  async function handleSaveRole(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const result = await upsertCustomerCustomRole({
      roleId: roleForm.roleId,
      roleName: roleForm.roleName,
      allowedMenuKeys: roleForm.allowedMenuKeys,
      isActive: roleForm.isActive,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccess('บันทึก role เรียบร้อยแล้ว');
    setRoleForm(EMPTY_ROLE_FORM);
    await loadAll();
  }

  async function handleDeleteRole(roleId) {
    if (!window.confirm('ลบ role นี้? ผู้ใช้ที่ถูกกำหนด role นี้ไว้จะกลับไปเห็นเมนูทั้งหมด')) return;
    setError('');
    const result = await deleteCustomerCustomRole(roleId);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await loadAll();
  }

  async function handleAssignRole(userProfileId, customRoleId) {
    setError('');
    const result = await assignCustomerUserCustomRole(userProfileId, customRoleId || null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await loadAll();
  }

  if (role && role !== 'customer_admin') {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-team-roles-page">
        <div className="banner banner-warning" role="status">ต้องมีสิทธิ์ customer_admin เท่านั้น</div>
      </section>
    );
  }

  if (profileLoading || loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-team-roles-page">
        <LoadingState message="กำลังโหลดข้อมูล..." />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-team-roles-page">
      <PageHeader
        title="จัดการสิทธิ์ผู้ใช้งาน"
        description="กำหนด role และเมนูที่พนักงานในบริษัทของคุณสามารถเข้าถึงได้"
      />
      <CustomerPortalLiveBanner />

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-team-role-form" onSubmit={handleSaveRole}>
        <div className="form-grid">
          <label className="form-field">
            <span>ชื่อ Role</span>
            <input
              className="form-control"
              onChange={(e) => setRoleForm((c) => ({ ...c, roleName: e.target.value }))}
              required
              value={roleForm.roleName}
            />
          </label>
          <label className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={roleForm.isActive}
              onChange={(e) => setRoleForm((c) => ({ ...c, isActive: e.target.checked }))}
            />
            <span>เปิดใช้งาน</span>
          </label>
          <div className="form-field form-field-span-2">
            <span>เมนูที่เข้าถึงได้</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
              {MENU_KEY_OPTIONS.map((opt) => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={roleForm.allowedMenuKeys.includes(opt.key)}
                    onChange={() => toggleMenuKey(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="action-row">
          {roleForm.roleId ? (
            <button className="btn btn-secondary" type="button" onClick={() => setRoleForm(EMPTY_ROLE_FORM)}>
              ยกเลิกแก้ไข
            </button>
          ) : null}
          <button className="btn btn-primary" disabled={saving} type="submit">
            {roleForm.roleId ? 'บันทึกการแก้ไข' : 'เพิ่ม Role'}
          </button>
        </div>
      </form>

      <div className="table-card">
        <div className="table-card-header"><h3>Role ที่กำหนดไว้</h3></div>
        <div className="table-responsive">
          <table className="tgd-table">
            <thead>
              <tr>
                <th>ชื่อ Role</th>
                <th>เมนูที่เข้าถึงได้</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--tgd-muted-text)' }}>ยังไม่มี role ที่กำหนดไว้</td></tr>
              ) : roles.map((r) => (
                <tr key={r.id}>
                  <td>{r.role_name}</td>
                  <td>
                    {(r.allowed_menu_keys ?? []).map((key) => MENU_KEY_OPTIONS.find((o) => o.key === key)?.label ?? key).join(', ') || '-'}
                  </td>
                  <td>{r.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</td>
                  <td>
                    <button className="btn btn-outline" type="button" onClick={() => startEdit(r)} style={{ marginRight: 6 }}>แก้ไข</button>
                    <button className="btn btn-danger" type="button" onClick={() => handleDeleteRole(r.id)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header"><h3>พนักงานในบริษัท</h3></div>
        <div className="table-responsive">
          <table className="tgd-table">
            <thead>
              <tr>
                <th>อีเมล</th>
                <th>ชื่อ</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {teamUsers.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--tgd-muted-text)' }}>ยังไม่มีผู้ใช้งาน (customer_user) ในบริษัทนี้</td></tr>
              ) : teamUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.display_name ?? '-'}</td>
                  <td>
                    <select
                      className="form-control"
                      value={u.customer_custom_role_id ?? ''}
                      onChange={(e) => handleAssignRole(u.id, e.target.value)}
                    >
                      <option value="">— ไม่จำกัด (เข้าถึงได้ทุกเมนู) —</option>
                      {roles.filter((r) => r.is_active).map((r) => (
                        <option key={r.id} value={r.id}>{r.role_name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

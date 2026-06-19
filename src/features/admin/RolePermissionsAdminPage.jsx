import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { listRoleDefinitions, upsertRoleDefinition } from '../../services/productServiceRatesService.js';
import { PRODUCTION_ROLES, PRODUCTION_ROLE_DESCRIPTIONS } from '../../security/productionRoleModel.js';
import { groupRoutesByPermissionArea } from '../../security/routePermissionCatalog.js';
import { getUserProfiles } from '../../services/userManagementService.js';

const AREA_LABELS = {
  receiving:           'รับสินค้าเข้า',
  putaway:             'นำสินค้าเข้าที่เก็บ',
  transfer:            'โอนย้ายสินค้า',
  adjustment:          'ปรับยอดสินค้า',
  withdrawal:          'เบิกสินค้า',
  allocation:          'จัดสรรสินค้า',
  picking:             'หยิบสินค้า (Picking)',
  dispatch:            'จัดส่งสินค้า',
  stock_count:         'นับสต็อก',
  reports:             'รายงาน',
  accounting_review:   'ตรวจสอบบัญชี',
  admin:               'ผู้ดูแลระบบ',
  user_management:     'จัดการผู้ใช้',
  customer_catalog:    'แคตตาล็อกสินค้า',
  customer_portal:     'Customer Portal',
  unknown:             'อื่นๆ',
};

const ROLE_ORDER = ['admin','warehouse_manager','warehouse_admin','warehouse_staff','accounting','viewer','customer_user'];

function hasAccess(role, minRole) {
  const order = ROLE_ORDER;
  return order.indexOf(role) <= order.indexOf(minRole);
}

function PermissionMatrix({ roles }) {
  const byArea = groupRoutesByPermissionArea();
  const areas = Object.keys(byArea).filter((a) => a !== 'unknown');

  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 160 }}>
              ฟีเจอร์
            </th>
            {ROLE_ORDER.map((r) => {
              const def = roles.find((d) => d.role_code === r);
              return (
                <th key={r} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 110 }}>
                  {def?.display_name?.split(' ')[0] ?? r}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => {
            const minRole = byArea[area]?.[0]?.minimum_role ?? 'admin';
            return (
              <tr key={area} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 14px', fontWeight: 600, color: '#1e293b' }}>
                  {AREA_LABELS[area] ?? area}
                </td>
                {ROLE_ORDER.map((r) => {
                  const ok = hasAccess(r, minRole);
                  return (
                    <td key={r} style={{ padding: '8px', textAlign: 'center' }}>
                      {ok ? (
                        <span style={{ color: '#2d9348', fontSize: 16 }}>✓</span>
                      ) : (
                        <span style={{ color: '#e5e7eb', fontSize: 14 }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoleCard({ role, userCount, onEdit }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: '#f0fdf4',
        border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>
        {role.is_system ? '🔒' : '✏️'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{role.display_name}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{role.description ?? ''}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontFamily: 'monospace' }}>
          role: <strong>{role.role_code}</strong>
          {role.base_role && role.base_role !== role.role_code ? ` → ${role.base_role}` : ''}
          {userCount != null ? ` · ${userCount} ผู้ใช้` : ''}
        </div>
      </div>
      {!role.is_system && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onEdit(role)}
        >
          แก้ไข
        </button>
      )}
    </div>
  );
}

const EMPTY_ROLE_FORM = {
  id: '',
  roleCode: '',
  displayName: '',
  description: '',
  baseRole: 'viewer',
};

export function RolePermissionsAdminPage() {
  const [tab, setTab] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleForm, setRoleForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [roleResult, userResult] = await Promise.all([
      listRoleDefinitions(),
      getUserProfiles(),
    ]);
    setRoles(roleResult.data ?? []);
    setUsers(userResult.data ?? []);
  }

  const usersByRole = users.reduce((acc, u) => {
    const r = u.role ?? 'viewer';
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  async function handleRoleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const result = await upsertRoleDefinition({
      id:          roleForm.id || undefined,
      roleCode:    roleForm.roleCode,
      displayName: roleForm.displayName,
      description: roleForm.description,
      baseRole:    roleForm.baseRole,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message ?? 'บันทึกไม่สำเร็จ');
      return;
    }
    setSuccess('บันทึก Role เรียบร้อยแล้ว');
    setRoleForm(null);
    await load();
  }

  const TAB_STYLE = (active) => ({
    padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
    fontSize: 13, border: 'none',
    background: active ? '#2d9348' : 'transparent',
    color: active ? '#fff' : '#64748b',
    transition: 'all 0.15s',
  });

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="จัดการสิทธิ์และบทบาทผู้ใช้"
        description="กำหนดบทบาทในระบบ ดูสิทธิ์ต่อฟีเจอร์ และสร้าง role ใหม่ได้"
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, background: '#f8fafc', borderRadius: 10, padding: 6, marginBottom: 20, width: 'fit-content' }}>
        {[
          { key: 'roles', label: 'บทบาท (Roles)' },
          { key: 'matrix', label: 'ตารางสิทธิ์' },
          { key: 'users', label: 'ผู้ใช้ตามบทบาท' },
        ].map((t) => (
          <button key={t.key} type="button" style={TAB_STYLE(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="banner banner-success" style={{ marginBottom: 12 }}>{success}</div>}

      {/* ── Tab: Roles ── */}
      {tab === 'roles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setRoleForm({ ...EMPTY_ROLE_FORM }); setError(''); setSuccess(''); }}
            >
              + สร้าง Role ใหม่
            </button>
          </div>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#94a3b8' }}>
            🔒 System roles — แก้ไขได้แค่ชื่อแสดง &nbsp;|&nbsp; ✏️ Custom roles — แก้ไขได้เต็มรูปแบบ
          </div>
          {roles.map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              userCount={usersByRole[r.role_code]}
              onEdit={(role) => setRoleForm({
                id:          role.id,
                roleCode:    role.role_code,
                displayName: role.display_name,
                description: role.description ?? '',
                baseRole:    role.base_role ?? role.role_code,
              })}
            />
          ))}
        </div>
      )}

      {/* ── Tab: Permission Matrix ── */}
      {tab === 'matrix' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14 }}>
            ตารางสิทธิ์เข้าถึงฟีเจอร์
          </div>
          <PermissionMatrix roles={roles} />
        </div>
      )}

      {/* ── Tab: Users by role ── */}
      {tab === 'users' && (
        <div>
          {ROLE_ORDER.map((roleCode) => {
            const roleUsers = users.filter((u) => (u.role ?? 'viewer') === roleCode);
            const def = roles.find((r) => r.role_code === roleCode);
            if (!roleUsers.length) return null;
            return (
              <div key={roleCode} style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#1e293b' }}>
                  {def?.display_name ?? roleCode}
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>
                    ({roleUsers.length} คน)
                  </span>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  {roleUsers.map((u, i) => (
                    <div key={u.id} style={{
                      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
                      borderBottom: i < roleUsers.length - 1 ? '1px solid #f1f5f9' : 'none',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: '#eff6ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: '#1d6fcf', flexShrink: 0,
                      }}>
                        {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                          {u.display_name ?? '(ไม่มีชื่อ)'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.email ?? ''}</div>
                      </div>
                      <div style={{ marginLeft: 'auto' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                          background: u.is_active ? '#f0fdf4' : '#f1f5f9',
                          color: u.is_active ? '#2d9348' : '#94a3b8',
                        }}>
                          {u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role create/edit modal */}
      {roleForm !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>
              {roleForm.id ? 'แก้ไข Role' : 'สร้าง Role ใหม่'}
            </h3>
            <form onSubmit={handleRoleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Role Code * <span style={{ fontWeight: 400, color: '#94a3b8' }}>(ตัวอักษรเล็ก ไม่มีช่องว่าง)</span>
                </label>
                <input
                  className="form-control"
                  required
                  disabled={!!roleForm.id}
                  value={roleForm.roleCode}
                  onChange={(e) => setRoleForm((f) => ({ ...f, roleCode: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                  placeholder="เช่น custom_viewer"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ชื่อแสดง *</label>
                <input
                  className="form-control"
                  required
                  value={roleForm.displayName}
                  onChange={(e) => setRoleForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="เช่น ผู้ตรวจสอบ (Auditor)"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>คำอธิบาย</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              {!roleForm.id && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    สิทธิ์อ้างอิงจาก (Base Role) *
                  </label>
                  <select
                    className="form-control"
                    value={roleForm.baseRole}
                    onChange={(e) => setRoleForm((f) => ({ ...f, baseRole: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    {PRODUCTION_ROLES.map((r) => (
                      <option key={r} value={r}>{r} — {PRODUCTION_ROLE_DESCRIPTIONS[r]}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>
                    Custom role จะได้รับสิทธิ์เดียวกับ base role ที่เลือก
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRoleForm(null)} disabled={saving}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

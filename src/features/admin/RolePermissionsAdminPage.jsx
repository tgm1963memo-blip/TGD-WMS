import { Fragment, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { listRoleDefinitions, upsertRoleDefinition } from '../../services/productServiceRatesService.js';
import { PRODUCTION_ROLES, PRODUCTION_ROLE_DESCRIPTIONS } from '../../security/productionRoleModel.js';
import { getUserProfiles } from '../../services/userManagementService.js';
import { listRoleFunctionPermissions, resetRoleFunctionPermissions, saveRoleFunctionPermissionOverrides } from '../../services/roleFunctionPermissionService.js';
import { refreshRolePermissionCache } from '../../services/roleAreaPermissionCacheService.js';
import { listNavigationPermissionFunctionsByGroup } from '../../security/navigationPermissionCatalog.js';
import {
  buildRoleFunctionMatrix,
  diffAllRoleFunctionOverrides,
  diffRoleFunctionOverrides,
  functionDraftsAreEqual,
  matrixDraftsAreEqual,
  getDefaultFunctionAccess,
  getRoleFunctionOverride,
} from '../../security/roleFunctionPermissions.js';

const GROUP_LABELS_TH = {
  main_operation: 'การดำเนินงานหลัก',
  inbound_management: 'รับเข้า',
  inventory_control: 'ควบคุมสต็อก',
  outbound_management: 'เบิกออก',
  barcode_handheld: 'Barcode / Handheld',
  customer_portal: 'Customer Portal',
  billing: 'การเรียกเก็บเงิน',
  reports: 'รายงาน',
  system_administration: 'ระบบผู้ดูแล',
};

const MATRIX_ROLE_ORDER = ['admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'accounting', 'viewer', 'customer_user'];

function sortMatrixRoles(roles) {
  const orderIndex = new Map(MATRIX_ROLE_ORDER.map((code, index) => [code, index]));
  return [...roles]
    .filter((role) => role.is_active !== false)
    .sort((left, right) => {
      const leftOrder = orderIndex.get(left.role_code) ?? 999;
      const rightOrder = orderIndex.get(right.role_code) ?? 999;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return String(left.display_name ?? left.role_code).localeCompare(String(right.display_name ?? right.role_code), 'th');
    });
}

function EditablePermissionMatrix({
  roles,
  draftMatrix,
  savedMatrix,
  onToggle,
  dirty,
  saving,
  onSave,
  onResetDraft,
}) {
  const matrixRoles = useMemo(() => sortMatrixRoles(roles), [roles]);
  const groupedFunctions = useMemo(() => listNavigationPermissionFunctionsByGroup(), []);

  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa',
      }}>
        <div style={{ fontSize: 13, color: '#374151' }}>
          เลือกฟังก์ชันที่แต่ละบทบาทเข้าใช้งานได้ — ติ๊กเพื่อเปิด/ปิดสิทธิ์อิสระ
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={saving || !dirty}
            onClick={onResetDraft}
          >
            ยกเลิกการแก้ไข
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="role-permissions-save"
            disabled={saving || !dirty}
            onClick={onSave}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์ทั้งหมด'}
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 18px', fontSize: 12, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ color: '#2d9348' }}>●</span> ค่าเริ่มต้น &nbsp;
        <span style={{ color: '#1d6fcf' }}>●</span> ปรับแต่งแล้ว &nbsp;|&nbsp;
        บทบาท Admin มีสิทธิ์ครบทุกฟังก์ชัน
      </div>

      <div style={{ overflowX: 'auto', marginTop: 0 }}>
        <table
          data-testid="role-permissions-matrix"
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}
        >
          <thead>
            <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 220 }}>
                ฟังก์ชัน
              </th>
              {matrixRoles.map((role) => (
                <th
                  key={role.role_code}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: 96,
                    fontSize: 11,
                  }}
                  title={role.role_code}
                >
                  {role.display_name?.split(' ')[0] ?? role.role_code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedFunctions.map((group) => (
              <Fragment key={group.groupKey}>
                <tr key={`group-${group.groupKey}`} style={{ background: '#f1f5f9' }}>
                  <td
                    colSpan={matrixRoles.length + 1}
                    style={{ padding: '8px 14px', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                  >
                    {GROUP_LABELS_TH[group.groupKey] ?? group.groupLabel}
                  </td>
                </tr>
                {group.items.map((fn) => (
                  <tr key={fn.functionKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 14px', color: '#1e293b' }}>
                      <div style={{ fontWeight: 600 }}>{fn.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        {fn.minimumRole ? `ขั้นต่ำ: ${fn.minimumRole}` : fn.path}
                      </div>
                    </td>
                    {matrixRoles.map((role) => {
                      const roleCode = role.role_code;
                      const isAdminLocked = roleCode === 'admin';
                      const displayValue = Boolean(draftMatrix?.[roleCode]?.[fn.functionKey]);
                      const savedValue = Boolean(savedMatrix?.[roleCode]?.[fn.functionKey]);
                      const isOverride = getRoleFunctionOverride(roleCode, fn.functionKey) !== undefined
                        || displayValue !== getDefaultFunctionAccess(roleCode, fn.functionKey);

                      if (isAdminLocked) {
                        return (
                          <td key={roleCode} style={{ padding: '8px', textAlign: 'center', background: '#fafafa' }}>
                            <input type="checkbox" checked disabled aria-label={`${role.display_name} ${fn.label}`} style={{ width: 24, height: 24, accentColor: '#cbd5e1' }} />
                          </td>
                        );
                      }

                      return (
                        <td key={roleCode} style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            data-testid={`role-permission-${roleCode}-${fn.functionKey}`}
                            checked={displayValue}
                            onChange={(e) => onToggle(roleCode, fn.functionKey, e.target.checked)}
                            aria-label={`${role.display_name} ${fn.label}`}
                            style={{
                              width: 24,
                              height: 24,
                              accentColor: isOverride || displayValue !== savedValue ? '#1d6fcf' : '#2d9348',
                              cursor: 'pointer',
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RolePermissionInlineEditor({ role, permissions, matrixRoleCodes, saving, onSave, onCancel }) {
  const groupedFunctions = useMemo(() => listNavigationPermissionFunctionsByGroup(), []);
  const { matrix } = useMemo(
    () => buildRoleFunctionMatrix(matrixRoleCodes, permissions),
    [matrixRoleCodes, permissions],
  );

  const initialDraft = useMemo(() => ({ ...(matrix[role.role_code] ?? {}) }), [matrix, role.role_code]);
  const [draft, setDraft] = useState(initialDraft);

  const dirty = useMemo(() => !functionDraftsAreEqual(draft, initialDraft), [draft, initialDraft]);

  function toggle(functionKey) {
    setDraft((prev) => ({ ...prev, [functionKey]: !prev[functionKey] }));
  }

  return (
    <div style={{
      margin: '0 0 8px',
      padding: '16px 20px',
      background: '#f0fdf4',
      borderRadius: '0 0 12px 12px',
      border: '1px solid #bbf7d0',
      borderTop: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <span style={{ fontWeight: 700, color: '#166534', marginRight: 10 }}>สิทธิ์ฟังก์ชัน — {role.display_name}</span>
          เลือกเมนู/ฟังก์ชันที่บทบาทนี้เข้าใช้งานได้
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setDraft(initialDraft)}
            disabled={saving || !dirty}
          >
            คืนค่า
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
            ปิด
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onSave(role.role_code, draft)}
            disabled={saving || !dirty}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
          </button>
        </div>
      </div>

      {groupedFunctions.map((group) => (
        <div key={group.groupKey} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
            {GROUP_LABELS_TH[group.groupKey] ?? group.groupLabel}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
            {group.items.map((fn) => {
              const isOn = Boolean(draft[fn.functionKey]);
              const isDefault = getDefaultFunctionAccess(role.role_code, fn.functionKey);
              const isCustomized = isOn !== isDefault;
              return (
                <label
                  key={fn.functionKey}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', padding: '10px 14px',
                    background: '#fff', borderRadius: 8,
                    border: `1px solid ${isCustomized ? '#93c5fd' : '#e5e7eb'}`,
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(fn.functionKey)}
                    style={{ width: 16, height: 16, accentColor: '#2d9348', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{fn.label}</div>
                    <div style={{ fontSize: 10, marginTop: 1, color: isCustomized ? '#1d6fcf' : '#94a3b8' }}>
                      {isCustomized ? 'ปรับแต่งแล้ว' : 'ค่าเริ่มต้น'}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleCard({ role, userCount, onEdit, onEditPermissions, isPermissionExpanded }) {
  const canEditPermissions = role.role_code !== 'admin';
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isPermissionExpanded ? '#bbf7d0' : '#e5e7eb'}`,
      borderRadius: isPermissionExpanded ? '12px 12px 0 0' : 12,
      borderBottom: isPermissionExpanded ? 'none' : undefined,
      padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      marginBottom: isPermissionExpanded ? 0 : 8,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: '#f0fdf4',
        border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>
        {role.is_system ? '🔒' : '✏️'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{role.display_name}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{role.description ?? ''}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontFamily: 'monospace' }}>
          role: <strong>{role.role_code}</strong>
          {role.base_role && role.base_role !== role.role_code ? ` → ${role.base_role}` : ''}
          {userCount != null ? ` · ${userCount} ผู้ใช้` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {canEditPermissions && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onEditPermissions(role)}
          >
            {isPermissionExpanded ? 'ซ่อนสิทธิ์' : 'แก้ไขสิทธิ์'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onEdit(role)}
        >
          แก้ไข
        </button>
      </div>
    </div>
  );
}

const ROLE_ORDER = ['admin','warehouse_manager','warehouse_admin','warehouse_staff','accounting','viewer','customer_user'];

function buildFunctionMatrix(roleCodes, permissions) {
  const { matrix } = buildRoleFunctionMatrix(roleCodes, permissions);
  return matrix;
}

function cloneMatrix(matrix) {
  return JSON.parse(JSON.stringify(matrix ?? {}));
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
  const [permissions, setPermissions] = useState([]);
  const [permissionDraft, setPermissionDraft] = useState({});
  const [permissionBaseline, setPermissionBaseline] = useState({});
  const [savedMatrix, setSavedMatrix] = useState({});
  const [roleForm, setRoleForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedPermRole, setExpandedPermRole] = useState(null);
  const [inlineSaving, setInlineSaving] = useState(false);

  const matrixRoleCodes = useMemo(
    () => sortMatrixRoles(roles).map((role) => role.role_code),
    [roles],
  );

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!matrixRoleCodes.length) return;
    const matrix = buildFunctionMatrix(matrixRoleCodes, permissions);
    setPermissionDraft(cloneMatrix(matrix));
    setPermissionBaseline(cloneMatrix(matrix));
    setSavedMatrix(cloneMatrix(matrix));
  }, [permissions, matrixRoleCodes]);

  async function load() {
    const [roleResult, userResult, permissionResult] = await Promise.all([
      listRoleDefinitions(),
      getUserProfiles(),
      listRoleFunctionPermissions(),
    ]);
    setRoles(roleResult.data ?? []);
    setUsers(userResult.data ?? []);
    setPermissions(permissionResult.data ?? []);
    await refreshRolePermissionCache();
  }

  const permissionDirty = useMemo(
    () => !matrixDraftsAreEqual(permissionBaseline, permissionDraft),
    [permissionBaseline, permissionDraft],
  );

  function handleMatrixToggle(roleCode, functionKey, allowed) {
    setPermissionDraft((current) => ({
      ...current,
      [roleCode]: {
        ...(current[roleCode] ?? {}),
        [functionKey]: allowed,
      },
    }));
  }

  function handlePermissionDraftReset() {
    setPermissionDraft(cloneMatrix(permissionBaseline));
  }

  async function handlePermissionSave() {
    const changedRoles = diffAllRoleFunctionOverrides(permissionBaseline, permissionDraft);
    if (!changedRoles.length) return;

    setPermissionSaving(true);
    setError('');
    setSuccess('');

    for (const { roleCode, diff } of changedRoles) {
      const result = await saveRoleFunctionPermissionOverrides(roleCode, diff);
      if (result.error) {
        setPermissionSaving(false);
        setError(result.error.message ?? `บันทึกสิทธิ์ของ ${roleCode} ไม่สำเร็จ`);
        return;
      }
    }

    setPermissionSaving(false);
    setSuccess(`บันทึกสิทธิ์ ${changedRoles.length} บทบาทเรียบร้อยแล้ว`);
    await load();
  }

  const usersByRole = users.reduce((acc, u) => {
    const r = u.role ?? 'viewer';
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  async function handleInlinePermissionSave(roleCode, draft) {
    setInlineSaving(true);
    setError('');
    setSuccess('');
    const diff = diffRoleFunctionOverrides(roleCode, draft);
    const result = await saveRoleFunctionPermissionOverrides(roleCode, diff);
    setInlineSaving(false);
    if (result.error) {
      setError(result.error.message ?? 'บันทึกสิทธิ์ไม่สำเร็จ');
      return;
    }
    setSuccess(`บันทึกสิทธิ์ของ ${roleCode} เรียบร้อยแล้ว`);
    setExpandedPermRole(null);
    await load();
  }

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
        description="กำหนดบทบาท ปรับสิทธิ์เข้าถึงแต่ละฟังก์ชัน/เมนูได้อิสระ และสร้าง role ใหม่ได้"
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
            <div key={r.id}>
              <RoleCard
                role={r}
                userCount={usersByRole[r.role_code]}
                isPermissionExpanded={expandedPermRole === r.role_code}
                onEdit={(role) => setRoleForm({
                  id:          role.id,
                  roleCode:    role.role_code,
                  displayName: role.display_name,
                  description: role.description ?? '',
                  baseRole:    role.base_role ?? role.role_code,
                })}
                onEditPermissions={(role) => {
                  setExpandedPermRole((prev) => (prev === role.role_code ? null : role.role_code));
                  setError('');
                  setSuccess('');
                }}
              />
              {expandedPermRole === r.role_code && r.role_code !== 'admin' && (
                <RolePermissionInlineEditor
                  role={r}
                  permissions={permissions}
                  matrixRoleCodes={matrixRoleCodes}
                  saving={inlineSaving}
                  onSave={handleInlinePermissionSave}
                  onCancel={() => setExpandedPermRole(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Permission Matrix ── */}
      {tab === 'matrix' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14 }}>
            ตารางสิทธิ์เข้าถึงฟังก์ชัน (เมนูระบบ)
          </div>
          <EditablePermissionMatrix
            roles={roles}
            draftMatrix={permissionDraft}
            savedMatrix={savedMatrix}
            onToggle={handleMatrixToggle}
            dirty={permissionDirty}
            saving={permissionSaving}
            onSave={handlePermissionSave}
            onResetDraft={handlePermissionDraftReset}
          />
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
                  Role จะได้รับสิทธิ์เดียวกับ base role ที่เลือก
                </p>
              </div>
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

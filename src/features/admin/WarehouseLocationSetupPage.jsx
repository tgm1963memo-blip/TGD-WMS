import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import {
  ensureDefaultWarehouse,
  getSectionsWithOccupancy,
  createSection,
  deleteSection,
  updateSectionSize,
} from '../../services/warehouseLayoutService.js';
import { parseLocationCode } from '../../utils/locationCodeUtils.js';

const DEFAULT_CAPACITY = 14;

const EMPTY_FORM = {
  zoneCode: '',
  zoneName: '',
  temperatureType: 'FROZEN',
  sideLeft: true,
  leftRows: 5,
  leftStaging: false,
  sideRight: true,
  rightRows: 5,
  rightStaging: false,
  capacity: DEFAULT_CAPACITY,
};

const TEMP_OPTIONS = [
  { value: 'FROZEN', label: 'FROZEN — แช่แข็ง', color: '#1d6fcf', bg: '#eff6ff' },
  { value: 'CHILLED', label: 'CHILLED — แช่เย็น', color: '#0e7a3a', bg: '#f0fdf4' },
  { value: 'AMBIENT', label: 'AMBIENT — อุณหภูมิห้อง', color: '#c97d00', bg: '#fffbeb' },
];

const TEMP_BADGE = {
  FROZEN: { label: 'แช่แข็ง', color: '#1d6fcf', bg: '#eff6ff' },
  CHILLED: { label: 'แช่เย็น', color: '#0e7a3a', bg: '#f0fdf4' },
  AMBIENT: { label: 'อุณหภูมิห้อง', color: '#c97d00', bg: '#fffbeb' },
};

function pctColor(pct) {
  if (pct >= 80) return '#e74c3c';
  if (pct >= 60) return '#e07b00';
  if (pct >= 40) return '#f0c419';
  return '#3498db';
}

function describeGrid(gridInfo) {
  if (!gridInfo || !gridInfo.rows) return '';
  const parts = [];
  if (gridInfo.sidesConfig?.L?.rows > 0) parts.push(`L: ${gridInfo.sidesConfig.L.rows} แถว`);
  if (gridInfo.sidesConfig?.R?.rows > 0) parts.push(`R: ${gridInfo.sidesConfig.R.rows} แถว`);
  return parts.join(' · ');
}

function sectionCapacity(section) {
  return section.locations?.find((l) => l.capacity)?.capacity ?? DEFAULT_CAPACITY;
}

// A "รอจ่าย" staging row is just row 0 for that side (see
// locationCodeUtils.js's formatRowLabel) -- not reflected in
// gridInfo.sidesConfig.rows (a MAX of real row numbers, unaffected by 0),
// so its presence has to be detected directly off this zone's own locations.
function sideHasStagingRow(section, side) {
  return (section.locations ?? []).some((l) => {
    const parsed = parseLocationCode(l.location_code);
    return parsed?.side === side && parsed.row === 0;
  });
}

function initEditForm(section) {
  const sc = section.gridInfo?.sidesConfig ?? {};
  return {
    leftActive: (sc.L?.rows ?? 0) > 0,
    leftRows: sc.L?.rows || 5,
    leftStaging: sideHasStagingRow(section, 'L'),
    rightActive: (sc.R?.rows ?? 0) > 0,
    rightRows: sc.R?.rows || 5,
    rightStaging: sideHasStagingRow(section, 'R'),
    capacity: sectionCapacity(section),
  };
}

function SectionCard({ section, onDelete, onEdit }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(() => initEditForm(section));
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const color = pctColor(section.usedPct);
  const gridDesc = describeGrid(section.gridInfo);
  const tempBadge = TEMP_BADGE[section.temperatureType] ?? null;

  function setEf(k, v) { setEditForm((f) => ({ ...f, [k]: v })); }

  function openEdit() {
    setEditForm(initEditForm(section));
    setEditError('');
    setEditSuccess('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditError('');
    setEditSuccess('');
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete(section.id);
    setDeleting(false);
    setConfirm(false);
  }

  async function handleEditSave() {
    if (!editForm.leftActive && !editForm.rightActive) {
      setEditError('กรุณาเลือกฝั่งอย่างน้อย 1 ฝั่ง');
      return;
    }
    setEditSaving(true);
    setEditError('');
    setEditSuccess('');
    const lRows = Math.max(1, Math.min(50, +editForm.leftRows || 1));
    const rRows = Math.max(1, Math.min(50, +editForm.rightRows || 1));
    const capacity = Math.max(1, +editForm.capacity || DEFAULT_CAPACITY);
    const result = await onEdit(section.id, {
      zoneCode: section.code,
      zoneName: section.name,
      leftConfig: { active: editForm.leftActive, rows: lRows, staging: editForm.leftStaging },
      rightConfig: { active: editForm.rightActive, rows: rRows, staging: editForm.rightStaging },
      capacity,
    });
    setEditSaving(false);
    if (result?.error) {
      setEditError(result.error.message ?? 'บันทึกไม่สำเร็จ');
    } else {
      const { added, removed } = result?.data ?? {};
      setEditSuccess(`บันทึกสำเร็จ${added ? ` เพิ่ม ${added}` : ''}${removed ? ` ลบ ${removed}` : ''} Location`);
      setEditing(false);
    }
  }

  const efLR = Math.max(1, Math.min(50, +editForm.leftRows || 1));
  const efRR = Math.max(1, Math.min(50, +editForm.rightRows || 1));
  const editTotal = (editForm.leftActive ? efLR : 0) + (editForm.rightActive ? efRR : 0);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
      {/* Main row */}
      <div style={{ background: '#fff', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: '#f0fdf4', border: '1.5px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 12, color: '#2d9348', flexShrink: 0,
          textAlign: 'center', lineHeight: 1.2,
        }}>
          {section.code}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{section.name}</span>
            {tempBadge && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: tempBadge.bg, color: tempBadge.color, border: `1px solid ${tempBadge.color}33`,
              }}>
                {tempBadge.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {section.total} แถว · ความจุ {sectionCapacity(section)} pallet/แถว (รวม {section.totalCapacity} pallet)
            {gridDesc ? ` · ${gridDesc}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 80, height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${section.usedPct}%`, background: color, borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color, width: 70, textAlign: 'right' }}>
            {section.used}/{section.totalCapacity}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!confirm && (
            <button
              type="button"
              onClick={editing ? cancelEdit : openEdit}
              style={{ padding: '6px 10px', border: '1px solid #3b82f6', borderRadius: 8, background: editing ? '#eff6ff' : '#fff', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {editing ? 'ยกเลิก' : 'แก้ไข'}
            </button>
          )}
          {confirm ? (
            <>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12 }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '6px 12px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              style={{ padding: '6px 10px', border: 'none', borderRadius: 8, background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              ลบ
            </button>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb', padding: '16px 18px' }}>
          {editError && (
            <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
              {editError}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
            {/* Left side */}
            <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600, color: '#1e293b', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={editForm.leftActive}
                  onChange={(e) => setEf('leftActive', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2d9348' }}
                />
                ฝั่งซ้าย (L)
              </label>
              {editForm.leftActive && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    จำนวนแถว
                    <input
                      className="form-control"
                      type="number"
                      min={1} max={50}
                      value={editForm.leftRows}
                      onChange={(e) => setEf('leftRows', e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#b9660a', marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={editForm.leftStaging}
                      onChange={(e) => setEf('leftStaging', e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#b9660a' }}
                    />
                    มีแถวรอจ่าย (ก่อนแถว 1)
                  </label>
                </>
              )}
            </div>
            {/* Right side */}
            <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600, color: '#1e293b', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={editForm.rightActive}
                  onChange={(e) => setEf('rightActive', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2d9348' }}
                />
                ฝั่งขวา (R)
              </label>
              {editForm.rightActive && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    จำนวนแถว
                    <input
                      className="form-control"
                      type="number"
                      min={1} max={50}
                      value={editForm.rightRows}
                      onChange={(e) => setEf('rightRows', e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#b9660a', marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={editForm.rightStaging}
                      onChange={(e) => setEf('rightStaging', e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#b9660a' }}
                    />
                    มีแถวรอจ่าย (ก่อนแถว 1)
                  </label>
                </>
              )}
            </div>
          </div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, maxWidth: 220 }}>
            ความจุต่อแถว (pallet)
            <input
              className="form-control"
              type="number"
              min={1} max={99}
              value={editForm.capacity}
              onChange={(e) => setEf('capacity', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
            />
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>ใช้กับทุกแถวในห้องนี้ (ปกติ 12-16)</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              รวม <strong style={{ color: '#1e293b' }}>{editTotal}</strong> แถว
              {editForm.leftActive && <span style={{ color: '#94a3b8', marginLeft: 6 }}>L: {efLR}</span>}
              {editForm.leftActive && editForm.rightActive && <span style={{ color: '#94a3b8' }}> / </span>}
              {editForm.rightActive && <span style={{ color: '#94a3b8' }}>R: {efRR}</span>}
            </div>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={editSaving}
              style={{ marginLeft: 'auto', padding: '8px 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* Success message below card */}
      {editSuccess && (
        <div style={{ background: '#f0fdf4', borderTop: '1px solid #bbf7d0', padding: '8px 18px', fontSize: 13, color: '#2d9348', fontWeight: 600 }}>
          {editSuccess}
        </div>
      )}
    </div>
  );
}

function AddSectionForm({ onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const leftRows = Math.max(1, Math.min(50, +form.leftRows || 1));
  const rightRows = Math.max(1, Math.min(50, +form.rightRows || 1));
  const capacity = Math.max(1, +form.capacity || DEFAULT_CAPACITY);

  const total = (form.sideLeft ? leftRows : 0) + (form.sideRight ? rightRows : 0);
  const totalSides = (form.sideLeft ? 1 : 0) + (form.sideRight ? 1 : 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.zoneCode.trim() || !form.zoneName.trim()) {
      setError('กรุณากรอกรหัสและชื่อ Section');
      return;
    }
    if (totalSides === 0) {
      setError('กรุณาเลือกฝั่งอย่างน้อย 1 ฝั่ง');
      return;
    }
    setSaving(true);
    setError('');

    const leftConfig = { active: form.sideLeft, rows: leftRows, staging: form.leftStaging };
    const rightConfig = { active: form.sideRight, rows: rightRows, staging: form.rightStaging };

    const result = await onAdd({
      zoneCode: form.zoneCode.trim().toUpperCase(),
      zoneName: form.zoneName.trim(),
      temperatureType: form.temperatureType,
      leftConfig,
      rightConfig,
      capacity,
    });
    setSaving(false);
    if (result?.error) {
      setError(result.error.message ?? 'เพิ่มไม่สำเร็จ');
    } else {
      setForm(EMPTY_FORM);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#f8fafc',
      border: '2px dashed #cbd5e1',
      borderRadius: 12,
      padding: '20px',
      marginBottom: 16,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 14 }}>
        + เพิ่มห้องใหม่
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Room code + name */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          รหัสห้อง *
          <input
            className="form-control"
            type="text"
            value={form.zoneCode}
            onChange={(e) => set('zoneCode', e.target.value)}
            placeholder="เช่น H1 หรือ A"
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>ใช้เป็นส่วนแรกของรหัส Location</span>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          ชื่อห้อง *
          <input
            className="form-control"
            type="text"
            value={form.zoneName}
            onChange={(e) => set('zoneName', e.target.value)}
            placeholder="เช่น ห้องแช่แข็ง 1"
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
      </div>

      {/* Temperature type */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>ประเภทการจัดเก็บ</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TEMP_OPTIONS.map((opt) => {
            const active = form.temperatureType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('temperatureType', opt.value)}
                style={{
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400,
                  border: `2px solid ${active ? opt.color : '#e5e7eb'}`,
                  background: active ? opt.bg : '#fff',
                  color: active ? opt.color : '#374151',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Left / Right Configurations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 14 }}>
        {/* Left Side */}
        <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={form.sideLeft}
              onChange={(e) => set('sideLeft', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2d9348' }}
            />
            ฝั่งซ้าย (L)
          </label>
          {form.sideLeft && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                จำนวนแถว
                <input
                  className="form-control"
                  type="number"
                  min={1} max={50}
                  value={form.leftRows}
                  onChange={(e) => set('leftRows', e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#b9660a', marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={form.leftStaging}
                  onChange={(e) => set('leftStaging', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#b9660a' }}
                />
                มีแถวรอจ่าย (ก่อนแถว 1)
              </label>
            </>
          )}
        </div>

        {/* Right Side */}
        <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={form.sideRight}
              onChange={(e) => set('sideRight', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2d9348' }}
            />
            ฝั่งขวา (R)
          </label>
          {form.sideRight && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                จำนวนแถว
                <input
                  className="form-control"
                  type="number"
                  min={1} max={50}
                  value={form.rightRows}
                  onChange={(e) => set('rightRows', e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#b9660a', marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={form.rightStaging}
                  onChange={(e) => set('rightStaging', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#b9660a' }}
                />
                มีแถวรอจ่าย (ก่อนแถว 1)
              </label>
            </>
          )}
        </div>
      </div>

      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, maxWidth: 220 }}>
        ความจุต่อแถว (pallet)
        <input
          className="form-control"
          type="number"
          min={1} max={99}
          value={form.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
        />
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>ใช้กับทุกแถวในห้องนี้ (ปกติ 12-16)</span>
      </label>

      {/* Preview */}
      <div style={{
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
        padding: '10px 14px', marginBottom: 14, fontSize: 13,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 700, color: '#2d9348' }}>ตัวอย่างรหัส Location:</span>
        {form.zoneCode.trim() && totalSides > 0 ? (
          <span style={{ fontFamily: 'monospace', color: '#1e293b', background: '#fff', padding: '2px 8px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
            {form.zoneCode.trim().toUpperCase()}-{form.sideLeft ? 'L' : 'R'}-01
          </span>
        ) : (
          <span style={{ color: '#94a3b8' }}>กรอกรหัส Section และเลือกฝั่งก่อน</span>
        )}
        <span style={{ color: '#64748b' }}>
          รวม <strong style={{ color: '#1e293b', fontSize: 15 }}>{totalSides > 0 ? total : 0}</strong> แถว
          {totalSides > 0 && total > 0 && (
            <span style={{ color: '#94a3b8', marginLeft: 6 }}>
              (
                {form.sideLeft ? `L: ${leftRows}` : ''}
                {form.sideLeft && form.sideRight ? ' / ' : ''}
                {form.sideRight ? `R: ${rightRows}` : ''}
              ) · {total * capacity} pallet รวม
            </span>
          )}
        </span>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || totalSides === 0}
        style={{ width: '100%' }}
      >
        {saving ? 'กำลังสร้าง...' : `สร้างห้อง (${totalSides > 0 ? total : 0} แถว)`}
      </button>
    </form>
  );
}

export function WarehouseLocationSetupPage() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: wh, error: we } = await ensureDefaultWarehouse();
    if (we) { setError(we); setLoading(false); return; }
    setWarehouseId(wh.id);

    const { data, error: se } = await getSectionsWithOccupancy();
    setSections(data ?? []);
    setError(se);
    setLoading(false);
  }

  async function handleAdd(params) {
    const result = await createSection({ warehouseId, ...params });
    if (!result.error) await load();
    return result;
  }

  async function handleDelete(zoneId) {
    await deleteSection(zoneId);
    await load();
  }

  async function handleEdit(zoneId, params) {
    const result = await updateSectionSize(zoneId, params);
    if (!result.error) await load();
    return result;
  }

  const totalRows = sections.reduce((s, z) => s + z.total, 0);
  const totalCapacity = sections.reduce((s, z) => s + z.totalCapacity, 0);

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="ตั้งค่า Location คลังสินค้า"
        description="กำหนดห้อง ฝั่ง และแถว — รหัสรูปแบบ: {ห้อง}-{ฝั่ง}-{แถว} เช่น H1-L-01 (1 แถวบรรจุได้หลาย pallet ตามความจุที่ตั้งไว้)"
      />

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'ห้องทั้งหมด', value: sections.length, color: '#2563eb' },
          { label: 'แถวทั้งหมด', value: totalRows, color: '#2d9348' },
          { label: 'ความจุรวม (pallet)', value: totalCapacity, color: '#0e7a3a' },
          { label: 'Pallet ที่ใช้', value: sections.reduce((s, z) => s + z.used, 0), color: '#f0a500' },
          { label: 'Pallet ว่าง', value: sections.reduce((s, z) => s + z.empty, 0), color: '#94a3b8' },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
            padding: '14px 18px', minWidth: 130,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <AddSectionForm onAdd={handleAdd} />

      {loading ? (
        <div style={{ color: '#94a3b8', padding: 24, textAlign: 'center' }}>กำลังโหลด...</div>
      ) : error ? (
        <div className="banner banner-danger">{error.message}</div>
      ) : sections.length === 0 ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 32, background: '#f8fafc', borderRadius: 12 }}>
          ยังไม่มีห้อง — เพิ่มด้านบนเพื่อตั้งค่าผังคลัง
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 12 }}>
            ห้องที่มีอยู่ ({sections.length})
          </div>
          {sections.map((sec) => (
            <SectionCard key={sec.id} section={sec} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

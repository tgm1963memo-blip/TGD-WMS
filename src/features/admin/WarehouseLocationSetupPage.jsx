import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import {
  ensureDefaultWarehouse,
  getSectionsWithOccupancy,
  createSection,
  deleteSection,
} from '../../services/warehouseLayoutService.js';

const EMPTY_FORM = { zoneCode: '', zoneName: '', rows: 5, cols: 10 };

function pctColor(pct) {
  if (pct >= 80) return '#e74c3c';
  if (pct >= 60) return '#e07b00';
  if (pct >= 40) return '#f0c419';
  return '#3498db';
}

function SectionCard({ section, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const color = pctColor(section.usedPct);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(section.id);
    setDeleting(false);
    setConfirm(false);
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginBottom: 10,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: '#f0fdf4',
        border: '1.5px solid #bbf7d0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 13, color: '#2d9348', flexShrink: 0,
      }}>
        {section.code}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{section.name}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          {section.total} location · {section.rows} แถว × {section.cols} ช่อง
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 80, height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${section.usedPct}%`, background: color, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color, width: 36, textAlign: 'right' }}>
          {section.usedPct}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
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
  );
}

function AddSectionForm({ onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.zoneCode.trim() || !form.zoneName.trim()) {
      setError('กรุณากรอกรหัสและชื่อ Section');
      return;
    }
    const rows = Math.max(1, Math.min(20, +form.rows || 5));
    const cols = Math.max(1, Math.min(30, +form.cols || 10));
    setSaving(true);
    setError('');
    const result = await onAdd({ ...form, rows, cols, zoneCode: form.zoneCode.trim().toUpperCase(), zoneName: form.zoneName.trim() });
    setSaving(false);
    if (result?.error) {
      setError(result.error.message ?? 'เพิ่มไม่สำเร็จ');
    } else {
      setForm(EMPTY_FORM);
    }
  }

  const total = (Math.max(1, +form.rows || 1)) * (Math.max(1, +form.cols || 1));

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#f8fafc',
      border: '2px dashed #cbd5e1',
      borderRadius: 12,
      padding: '20px 20px',
      marginBottom: 16,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 14 }}>
        + เพิ่ม Section ใหม่
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          รหัส Section *
          <input
            className="form-control"
            type="text"
            value={form.zoneCode}
            onChange={(e) => set('zoneCode', e.target.value)}
            placeholder="เช่น S001"
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          ชื่อ Section *
          <input
            className="form-control"
            type="text"
            value={form.zoneName}
            onChange={(e) => set('zoneName', e.target.value)}
            placeholder="เช่น Section 001 ห้องเย็น"
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14, alignItems: 'end' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          จำนวนแถว (Rows)
          <input
            className="form-control"
            type="number"
            min={1} max={20}
            value={form.rows}
            onChange={(e) => set('rows', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          จำนวนช่อง (Cols)
          <input
            className="form-control"
            type="number"
            min={1} max={30}
            value={form.cols}
            onChange={(e) => set('cols', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ fontSize: 12, color: '#64748b', paddingBottom: 2 }}>
          รวม <strong style={{ color: '#1e293b', fontSize: 16 }}>{total}</strong> location
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving}
        style={{ width: '100%' }}
      >
        {saving ? 'กำลังสร้าง...' : `สร้าง Section (${total} location)`}
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

  async function handleAdd({ zoneCode, zoneName, rows, cols }) {
    const result = await createSection({ warehouseId, zoneCode, zoneName, rows, cols });
    if (!result.error) await load();
    return result;
  }

  async function handleDelete(zoneId) {
    await deleteSection(zoneId);
    await load();
  }

  const totalLocations = sections.reduce((s, z) => s + z.total, 0);

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="ตั้งค่า Location คลังสินค้า"
        description="กำหนด Section และตำแหน่งจัดเก็บสินค้า — ส่งผลต่อแผนผังและ Handheld"
      />

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Section ทั้งหมด', value: sections.length, color: '#2563eb' },
          { label: 'Location ทั้งหมด', value: totalLocations, color: '#2d9348' },
          { label: 'Location ที่มีสินค้า', value: sections.reduce((s, z) => s + z.used, 0), color: '#f0a500' },
          { label: 'Location ว่าง', value: sections.reduce((s, z) => s + z.empty, 0), color: '#94a3b8' },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
            padding: '14px 18px', minWidth: 140,
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
          ยังไม่มี Section — เพิ่มด้านบนเพื่อตั้งค่าผังคลัง
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 12 }}>
            Section ที่มีอยู่ ({sections.length})
          </div>
          {sections.map((sec) => (
            <SectionCard key={sec.id} section={sec} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

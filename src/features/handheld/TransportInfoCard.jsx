import { useEffect, useState } from 'react';
import { Check, Truck } from 'lucide-react';
import { getDocumentTransportInfo, setDocumentTransportInfo } from '../../services/transportInfoService.js';

// Handheld card for the seal number and the driver's name on a deposit
// (receiving). Both optional. Loads what is already on the document and
// saves through tgd_set_document_transport_info, same as the admin page.

const inputStyle = {
  width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '0 12px', borderRadius: 12,
  border: '1.5px solid var(--color-border)', background: 'var(--color-surface-muted)',
  color: 'var(--color-text)', font: 'inherit', fontSize: 15, fontWeight: 600,
};

export function TransportInfoCard({ documentType, requestId }) {
  const [sealNo, setSealNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [saved, setSaved] = useState({ seal: '', driver: '' });
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    getDocumentTransportInfo(documentType, requestId).then((result) => {
      if (!current) return;
      setLoading(false);
      setUnavailable(Boolean(result.unavailable));
      const seal = result.data?.seal_no ?? '';
      const driver = result.data?.driver_name ?? '';
      setSealNo(seal);
      setDriverName(driver);
      setSaved({ seal, driver });
    });
    return () => { current = false; };
  }, [documentType, requestId]);

  if (unavailable) return null;

  const dirty = sealNo.trim() !== saved.seal.trim() || driverName.trim() !== saved.driver.trim();

  async function save() {
    setSaving(true);
    setError('');
    setJustSaved(false);
    const { data, error: err } = await setDocumentTransportInfo(documentType, requestId, { sealNo, driverName });
    setSaving(false);
    if (err) { setError(err.message ?? 'บันทึกไม่สำเร็จ'); return; }
    const next = { seal: data?.seal_no ?? '', driver: data?.driver_name ?? '' };
    setSaved(next);
    setSealNo(next.seal);
    setDriverName(next.driver);
    setJustSaved(true);
  }

  return (
    <div
      data-testid="handheld-transport-card"
      style={{ margin: '0 14px 14px', background: 'var(--color-surface-sunken)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Truck size={14} aria-hidden="true" />เลขซีล / ชื่อผู้ขับรถ <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>(ไม่บังคับ)</span>
      </div>
      <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 700 }}>
        ชื่อผู้ขับรถ
        <input
          type="text" value={driverName} disabled={loading}
          onChange={(e) => { setDriverName(e.target.value); setJustSaved(false); }}
          autoComplete="off" data-testid="handheld-transport-driver" style={inputStyle}
        />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 700 }}>
        เลขซีล
        <input
          type="text" value={sealNo} disabled={loading}
          onChange={(e) => { setSealNo(e.target.value); setJustSaved(false); }}
          autoComplete="off" data-testid="handheld-transport-seal" style={inputStyle}
        />
      </label>
      {error ? <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, fontWeight: 700 }}>{error}</div> : null}
      <button
        type="button" onClick={save} disabled={loading || saving || !dirty}
        data-testid="handheld-transport-save"
        style={{
          minHeight: 48, borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14.5,
          background: dirty ? 'var(--color-sidebar)' : 'var(--color-border)',
          color: dirty ? '#fff' : 'var(--color-text-muted)', cursor: dirty ? 'pointer' : 'default',
        }}
      >
        {saving ? 'กำลังบันทึก...' : justSaved && !dirty
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} aria-hidden="true" />บันทึกแล้ว</span>
          : 'บันทึก'}
      </button>
    </div>
  );
}

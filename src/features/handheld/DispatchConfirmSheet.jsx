import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Image, X } from 'lucide-react';
import {
  DISPATCH_PHOTO_CATEGORIES,
  WITHDRAWAL_DISPATCH_PHOTO_DOCUMENT_TYPE,
  deleteCustomerDocumentAttachment,
  getCustomerDocumentAttachmentUrls,
  hasRequiredDispatchPhotos,
  listWithdrawalDispatchPhotos,
  uploadCustomerDocumentAttachments,
} from '../../services/customerDocumentAttachmentService.js';
import { getDocumentTransportInfo, setDocumentTransportInfo } from '../../services/transportInfoService.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

// "ขึ้นของเสร็จ" step on the handheld withdrawal: before loading can be
// closed, staff photograph the goods on the truck (required), optionally the
// plate and the seal / signed delivery note, and record the receiving
// driver's name (required) and seal number. Photos upload the moment they are
// taken, keyed to the withdrawal, so nothing is lost if the sheet closes.

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

function PhotoSlot({ category, photos, urls, pendingCount, disabled, onFiles, onDelete }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const has = photos.length > 0;
  return (
    <div
      data-testid={`dispatch-slot-${category.key}`}
      style={{ border: `1.5px ${has ? 'solid' : 'dashed'} ${has ? 'var(--color-success)' : 'var(--color-border-strong)'}`, borderRadius: 14, padding: 12, background: 'var(--color-surface)', display: 'grid', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 15 }}>
          {category.label}
          {category.required ? <span style={{ color: 'var(--color-danger)' }}> *</span> : <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 13 }}> (ไม่บังคับ)</span>}
        </div>
        {has ? <span style={{ color: 'var(--color-success-text)', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={14} aria-hidden="true" />{photos.length} รูป</span> : null}
      </div>
      {(photos.length > 0 || pendingCount > 0) && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', flex: '0 0 auto', background: 'var(--color-surface-muted)' }}>
              {urls[p.id] ? <img src={urls[p.id]} alt={category.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              <button
                type="button" onClick={() => onDelete(p)} aria-label="ลบรูป"
                style={{ position: 'absolute', top: 3, right: 3, width: 24, height: 24, borderRadius: 12, border: 'none', background: 'rgba(15,23,42,0.7)', color: '#fff', padding: 0, cursor: 'pointer' }}
              ><X size={13} aria-hidden="true" /></button>
            </div>
          ))}
          {Array.from({ length: pendingCount }, (_, i) => (
            <div key={`p${i}`} style={{ width: 72, height: 72, borderRadius: 10, border: '1px dashed var(--color-border-strong)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', flex: '0 0 auto' }}>กำลังอัปโหลด</div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()}
          style={{ flex: 1, minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--color-sidebar)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Camera size={18} aria-hidden="true" />ถ่ายรูป
        </button>
        <button type="button" disabled={disabled} onClick={() => galleryRef.current?.click()}
          style={{ flex: 1, minHeight: 48, borderRadius: 12, border: '1.5px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Image size={18} aria-hidden="true" />เลือกรูป
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => onFiles(category.key, e)} style={{ display: 'none' }} data-testid={`dispatch-camera-${category.key}`} />
        <input ref={galleryRef} type="file" accept="image/*" multiple onChange={(e) => onFiles(category.key, e)} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export function DispatchConfirmSheet({ doc, activeProfile, onClose, onFinish }) {
  const isOnline = useOnlineStatus();
  const [photos, setPhotos] = useState([]);
  const [urls, setUrls] = useState({});
  const [pending, setPending] = useState({});
  const [driverName, setDriverName] = useState('');
  const [sealNo, setSealNo] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refreshPhotos() {
    const { data, error: err } = await listWithdrawalDispatchPhotos(doc.id);
    if (err) { setError(err.message ?? 'โหลดรูปไม่สำเร็จ'); return; }
    setPhotos(data ?? []);
    const urlResult = await getCustomerDocumentAttachmentUrls(data ?? []);
    setUrls(urlResult.data ?? {});
  }

  useEffect(() => {
    refreshPhotos();
    getDocumentTransportInfo('CUSTOMER_WITHDRAWAL_REQUEST', doc.id).then(({ data }) => {
      if (data?.driver_name) setDriverName(data.driver_name);
      if (data?.seal_no) setSealNo(data.seal_no);
    });
  }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(categoryKey, event) {
    const files = Array.from(event.target.files ?? []).filter((f) => String(f.type || '').startsWith('image/') || !f.type);
    event.target.value = '';
    if (!files.length) return;
    if (!isOnline) { setError('ออฟไลน์อยู่ ต้องเชื่อมต่ออินเทอร์เน็ตเพื่ออัปโหลดรูป'); return; }
    const oversized = files.find((f) => f.size > MAX_PHOTO_BYTES);
    if (oversized) { setError(`${oversized.name} ใหญ่เกินไป`); return; }
    setError('');
    setPending((p) => ({ ...p, [categoryKey]: (p[categoryKey] ?? 0) + files.length }));
    const result = await uploadCustomerDocumentAttachments({
      documentType: WITHDRAWAL_DISPATCH_PHOTO_DOCUMENT_TYPE,
      documentId: doc.id,
      customerId: doc.customer_id,
      files,
      uploadedByUserId: activeProfile?.id ?? null,
      uploadedByEmail: activeProfile?.email ?? null,
      photoCategory: categoryKey,
    });
    setPending((p) => ({ ...p, [categoryKey]: Math.max(0, (p[categoryKey] ?? 0) - files.length) }));
    if (result.error) setError(result.error.message ?? 'อัปโหลดรูปไม่สำเร็จ');
    await refreshPhotos();
  }

  async function handleDelete(photo) {
    const result = await deleteCustomerDocumentAttachment(photo.id);
    if (result.error) { setError(result.error.message ?? 'ลบรูปไม่สำเร็จ'); return; }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  const photosReady = hasRequiredDispatchPhotos(photos);
  const driverReady = driverName.trim().length > 0;
  const uploading = Object.values(pending).some((n) => n > 0);
  const canConfirm = photosReady && driverReady && !uploading && !saving;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    setError('');
    const transport = await setDocumentTransportInfo('CUSTOMER_WITHDRAWAL_REQUEST', doc.id, { sealNo, driverName });
    if (transport.error) { setSaving(false); setError(transport.error.message ?? 'บันทึกชื่อผู้ขับ / เลขซีลไม่สำเร็จ'); return; }
    const ok = await onFinish();
    setSaving(false);
    if (ok === false) { setError('บันทึกเวลาเสร็จสิ้นไม่สำเร็จ ลองอีกครั้ง'); return; }
    onClose();
  }

  const missing = [];
  if (!photosReady) missing.push('รูปสินค้าบนรถ');
  if (!driverReady) missing.push('ชื่อผู้ขับรถ');

  return (
    <div
      role="dialog" aria-modal="true" aria-label="ยืนยันขึ้นของเสร็จ"
      data-testid="dispatch-confirm-sheet"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-surface-sunken)', display: 'grid', gridTemplateRows: 'auto 1fr auto', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div style={{ background: 'var(--color-sidebar)', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{doc.withdrawal_no ?? 'ใบเบิก'}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>ขึ้นของเสร็จ · ถ่ายรูปยืนยันการส่งสินค้า</div>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิด" style={{ background: 'transparent', border: 'none', color: '#fff', padding: 8, cursor: 'pointer' }}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, display: 'grid', gap: 12, alignContent: 'start' }}>
        {DISPATCH_PHOTO_CATEGORIES.map((category) => (
          <PhotoSlot
            key={category.key}
            category={category}
            photos={photos.filter((p) => p.photo_category === category.key)}
            urls={urls}
            pendingCount={pending[category.key] ?? 0}
            disabled={saving}
            onFiles={handleFiles}
            onDelete={handleDelete}
          />
        ))}

        <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: 12, background: 'var(--color-surface)', display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontWeight: 800, fontSize: 15 }}>
            <span>ชื่อผู้ขับรถที่รับสินค้า <span style={{ color: 'var(--color-danger)' }}>*</span></span>
            <input
              type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)}
              data-testid="dispatch-driver-name" autoComplete="off"
              style={{ font: 'inherit', fontWeight: 500, fontSize: 16, minHeight: 48, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontWeight: 800, fontSize: 15 }}>
            <span>เลขซีล <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 13 }}>(ไม่บังคับ)</span></span>
            <input
              type="text" value={sealNo} onChange={(e) => setSealNo(e.target.value)}
              data-testid="dispatch-seal-no" autoComplete="off"
              style={{ font: 'inherit', fontWeight: 500, fontSize: 16, minHeight: 48, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)' }}
            />
          </label>
        </div>

        {error ? (
          <div role="alert" style={{ padding: '10px 14px', background: 'var(--color-danger-soft)', color: 'var(--color-danger)', borderRadius: 12, fontSize: 14, fontWeight: 700 }}>{error}</div>
        ) : null}
      </div>

      <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'grid', gap: 6 }}>
        {missing.length > 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>ยังขาด: {missing.join(' และ ')}</div>
        ) : null}
        <button
          type="button" onClick={handleConfirm} disabled={!canConfirm}
          data-testid="dispatch-confirm-button"
          style={{ minHeight: 54, borderRadius: 14, border: 'none', background: canConfirm ? 'var(--color-sidebar)' : 'var(--color-border)', color: canConfirm ? '#fff' : 'var(--color-text-muted)', fontWeight: 800, fontSize: 16, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
        >
          {saving ? 'กำลังบันทึก...' : `ยืนยันขึ้นของเสร็จ (${photos.length} รูป)`}
        </button>
      </div>
    </div>
  );
}

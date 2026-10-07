import { useEffect, useRef, useState } from 'react';
import {
  DEPOSIT_RECEIVING_PHOTO_DOCUMENT_TYPE,
  deleteCustomerDocumentAttachment,
  getCustomerDocumentAttachmentUrls,
  listCustomerDocumentAttachments,
  uploadCustomerDocumentAttachments,
} from '../../services/customerDocumentAttachmentService.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // before compression; compressed to JPEG ≤2400px on upload

const S = {
  text: '#0f172a', textSec: '#475569', muted: '#94a3b8', border: '#e2e8f0',
  inputBg: '#f8fafc', red: '#dc2626', redLight: '#fef2f2', primary: '#09111c',
};

// Photos are uploaded the moment they're taken (not on "ยืนยันรับสินค้า"), keyed
// to the deposit line, so a photo is never lost if the confirm step fails or
// staff closes the sheet, and re-opening the line shows what's already there.
export function ReceivingPhotoCapture({ lineId, customerId, uploadedByUserId = null, uploadedByEmail = null }) {
  const isOnline = useOnlineStatus();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [urls, setUrls] = useState({});
  const [pending, setPending] = useState([]); // [{ key, previewUrl }]
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh(activeRef) {
    if (!lineId) { setPhotos([]); setUrls({}); return; }
    setLoading(true);
    const result = await listCustomerDocumentAttachments(DEPOSIT_RECEIVING_PHOTO_DOCUMENT_TYPE, lineId);
    if (activeRef && !activeRef.current) return;
    const rows = (result.data ?? []).slice().reverse(); // oldest first
    setPhotos(rows);
    if (result.error) setError(result.error.message ?? 'โหลดรูปไม่สำเร็จ');
    const urlResult = await getCustomerDocumentAttachmentUrls(rows);
    if (activeRef && !activeRef.current) return;
    setUrls(urlResult.data ?? {});
    setLoading(false);
  }

  useEffect(() => {
    const activeRef = { current: true };
    setPhotos([]); setUrls({}); setPending([]); setError('');
    refresh(activeRef);
    return () => { activeRef.current = false; };
  }, [lineId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? []).filter((f) => String(f.type || '').startsWith('image/') || !f.type);
    event.target.value = '';
    if (!files.length || !lineId || !customerId) return;
    if (!isOnline) { setError('ออฟไลน์อยู่ — ต้องเชื่อมต่ออินเทอร์เน็ตเพื่ออัปโหลดรูป'); return; }
    const oversized = files.find((f) => f.size > MAX_PHOTO_BYTES);
    if (oversized) { setError(`${oversized.name} ใหญ่เกินไป`); return; }

    setError('');
    const stamp = Date.now();
    const items = files.map((file, i) => ({ key: `${stamp}-${i}`, previewUrl: URL.createObjectURL(file) }));
    setPending((prev) => [...prev, ...items]);

    const result = await uploadCustomerDocumentAttachments({
      documentType: DEPOSIT_RECEIVING_PHOTO_DOCUMENT_TYPE,
      documentId: lineId,
      customerId,
      files,
      uploadedByUserId,
      uploadedByEmail,
    });

    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPending((prev) => prev.filter((p) => !items.some((item) => item.key === p.key)));
    if (result.error) setError(result.error.message ?? 'อัปโหลดรูปไม่สำเร็จ');
    await refresh();
  }

  async function handleDelete(photo) {
    if (!window.confirm('ลบรูปนี้?')) return;
    const result = await deleteCustomerDocumentAttachment(photo.id);
    if (result.error) { setError(result.error.message ?? 'ลบรูปไม่สำเร็จ'); return; }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  const buttonStyle = {
    flex: 1, minHeight: 48, borderRadius: 14, border: `1.5px solid ${S.border}`,
    background: S.inputBg, color: S.text, fontSize: 14, fontWeight: 800, cursor: 'pointer',
  };
  const thumbBox = {
    position: 'relative', width: 76, height: 76, borderRadius: 12, overflow: 'hidden',
    border: `1px solid ${S.border}`, background: S.inputBg, flex: '0 0 auto',
  };
  const count = photos.length + pending.length;

  return (
    <div style={{ marginBottom: 20 }} data-testid="handheld-receiving-photos">
      <div style={{ color: S.textSec, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        📷 รูปถ่ายสินค้ารับเข้า {count > 0 && <span style={{ color: S.muted }}>({count})</span>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" style={buttonStyle} disabled={!lineId} onClick={() => cameraInputRef.current?.click()}>
          📷 ถ่ายรูป
        </button>
        <button type="button" style={buttonStyle} disabled={!lineId} onClick={() => galleryInputRef.current?.click()}>
          🖼 เลือกรูป
        </button>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFiles} style={{ display: 'none' }} data-testid="handheld-receiving-photo-camera" />
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} data-testid="handheld-receiving-photo-gallery" />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: S.redLight, borderRadius: 12, color: S.red, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {(count > 0 || loading) && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {photos.map((photo) => (
            <div key={photo.id} style={thumbBox}>
              {urls[photo.id] ? (
                <a href={urls[photo.id]} target="_blank" rel="noopener noreferrer">
                  <img src={urls[photo.id]} alt={photo.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </a>
              ) : (
                <div style={{ fontSize: 11, color: S.muted, padding: 6 }}>…</div>
              )}
              <button type="button" onClick={() => handleDelete(photo)} aria-label="ลบรูป"
                style={{
                  position: 'absolute', top: 3, right: 3, width: 24, height: 24, borderRadius: 12,
                  border: 'none', background: 'rgba(15,23,42,0.7)', color: '#fff', fontSize: 13,
                  lineHeight: '24px', padding: 0, cursor: 'pointer',
                }}>✕</button>
            </div>
          ))}
          {pending.map((item) => (
            <div key={item.key} style={thumbBox}>
              <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.45 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: S.primary }}>
                กำลังอัปโหลด
              </div>
            </div>
          ))}
          {loading && !count && <div style={{ fontSize: 12, color: S.muted }}>กำลังโหลดรูป...</div>}
        </div>
      )}
    </div>
  );
}

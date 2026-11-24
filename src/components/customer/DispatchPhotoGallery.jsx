import { useEffect, useState } from 'react';
import {
  listWithdrawalDispatchPhotos,
  getCustomerDocumentAttachmentUrls,
  dispatchPhotoCategoryLabel,
  hasRequiredDispatchPhotos,
} from '../../services/customerDocumentAttachmentService.js';

// "รูปยืนยันการส่งสินค้า": photos the handheld took when loading finished,
// shown read-only on the withdrawal detail for admin and the customer.

function formatStamp(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function DispatchPhotoGallery({ withdrawalRequestId, dispatchFinishedAt = null, showUploader = true }) {
  const [photos, setPhotos] = useState(null);
  const [urls, setUrls] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setPhotos(null);
    setError('');
    listWithdrawalDispatchPhotos(withdrawalRequestId).then(async ({ data, error: err }) => {
      if (!current) return;
      if (err) { setPhotos([]); setError('โหลดรูปยืนยันการส่งสินค้าไม่สำเร็จ'); return; }
      setPhotos(data ?? []);
      const urlResult = await getCustomerDocumentAttachmentUrls(data ?? []);
      if (current) setUrls(urlResult.data ?? {});
    });
    return () => { current = false; };
  }, [withdrawalRequestId]);

  const missingRequired = photos && dispatchFinishedAt && !hasRequiredDispatchPhotos(photos);

  return (
    <div data-testid="dispatch-photo-gallery" style={{ gridColumn: '1 / -1' }}>
      <div className="form-label">รูปยืนยันการส่งสินค้า{photos?.length ? ` (${photos.length})` : ''}</div>
      {error ? <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div> : null}
      {photos === null ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>กำลังโหลด...</div>
      ) : photos.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {dispatchFinishedAt ? 'ไม่มีรูปยืนยันการส่งสินค้า' : 'ยังไม่มีรูป (ถ่ายจากเครื่อง handheld ตอนขึ้นของเสร็จ)'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 4 }}>
          {photos.map((photo) => (
            <figure key={photo.id} style={{ margin: 0, display: 'grid', gap: 4 }}>
              <a href={urls[photo.id]} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)' }}>
                {urls[photo.id] ? (
                  <img src={urls[photo.id]} alt={dispatchPhotoCategoryLabel(photo.photo_category)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : null}
              </a>
              <figcaption style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-text-muted)' }}>
                <strong style={{ display: 'block', color: 'var(--color-text)' }}>{dispatchPhotoCategoryLabel(photo.photo_category)}</strong>
                {formatStamp(photo.uploaded_at ?? photo.created_at)}
                {showUploader && photo.uploaded_by_email ? ` · ${photo.uploaded_by_email}` : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {missingRequired ? (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-warning)' }}>ไม่มีรูปสินค้าบนรถ</div>
      ) : null}
    </div>
  );
}

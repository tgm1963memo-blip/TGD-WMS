import { useEffect, useRef, useState } from 'react';
import {
  PRODUCT_PACKAGING_PHOTO_DOCUMENT_TYPE,
  deleteCustomerDocumentAttachment,
  getCustomerDocumentAttachmentUrls,
  listCustomerDocumentAttachments,
  uploadCustomerDocumentAttachments,
} from '../../services/customerDocumentAttachmentService.js';

// Packaging photos on a customer product. The newest one is what stock
// counters see on the Scan Center so they recognise the box on the shelf.
// Uploads/deletes apply immediately (independent of the product form's
// save button), same as the handheld receiving photos.
export function ProductPackagingPhotos({ productId, customerId }) {
  const inputRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [urls, setUrls] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const result = await listCustomerDocumentAttachments(PRODUCT_PACKAGING_PHOTO_DOCUMENT_TYPE, productId);
    if (result.error) setError(result.error.message ?? 'โหลดรูปไม่สำเร็จ');
    const rows = result.data ?? [];
    setPhotos(rows);
    const urlResult = await getCustomerDocumentAttachmentUrls(rows);
    setUrls(urlResult.data ?? {});
  }

  useEffect(() => {
    if (productId) refresh();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? []).filter((f) => String(f.type || '').startsWith('image/'));
    event.target.value = '';
    if (!files.length) return;
    setBusy(true); setError('');
    const result = await uploadCustomerDocumentAttachments({
      documentType: PRODUCT_PACKAGING_PHOTO_DOCUMENT_TYPE,
      documentId: productId,
      customerId,
      files,
    });
    setBusy(false);
    if (result.error) setError(result.error.message ?? 'อัปโหลดรูปไม่สำเร็จ');
    refresh();
  }

  async function handleDelete(photo) {
    if (!window.confirm('ลบรูปนี้?')) return;
    const result = await deleteCustomerDocumentAttachment(photo.id);
    if (result.error) { setError(result.error.message ?? 'ลบรูปไม่สำเร็จ'); return; }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  return (
    <div className="form-field" style={{ margin: '0 0 20px' }} data-testid="product-packaging-photos">
      <span>รูป Packaging (แสดงให้คนนับสต็อกดู — รูปล่าสุดจะถูกใช้)</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ position: 'relative', width: 88, height: 88, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--tgd-border)', background: '#f8fafc' }}>
            {urls[photo.id] && (
              <a href={urls[photo.id]} target="_blank" rel="noopener noreferrer">
                <img src={urls[photo.id]} alt={photo.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </a>
            )}
            <button type="button" aria-label="ลบรูป" onClick={() => handleDelete(photo)}
              style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, border: 'none', background: 'rgba(15,23,42,0.7)', color: '#fff', fontSize: 12, lineHeight: '22px', padding: 0, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'กำลังอัปโหลด...' : '+ เพิ่มรูป'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} data-testid="product-packaging-photo-input" />
      </div>
      {error && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}

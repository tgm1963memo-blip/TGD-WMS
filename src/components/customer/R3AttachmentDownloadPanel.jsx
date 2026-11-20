import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  describeAttachmentUploader,
  downloadCustomerDocumentAttachment,
  listCustomerDocumentAttachments,
} from '../../services/customerDocumentAttachmentService.js';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

function formatAttachmentSize(size) {
  if (size == null) return '-';
  return `${(Number(size) / 1024).toFixed(1)} KB`;
}

// Read-only list of the ร.3 files attached to a withdrawal request — both
// the ones the customer attached when creating it and the ones TGC staff
// uploaded from the admin review page — each downloadable.
export function R3AttachmentDownloadPanel({ documentType = 'CUSTOMER_WITHDRAWAL_REQUEST', documentId, showWhenEmpty = false }) {
  const [attachments, setAttachments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError('');
    if (!documentId) { setAttachments([]); setLoaded(true); return undefined; }
    listCustomerDocumentAttachments(documentType, documentId).then((result) => {
      if (!active) return;
      setAttachments(result.data ?? []);
      if (result.error) setError(result.error.message ?? 'โหลดไฟล์แนบไม่สำเร็จ');
      setLoaded(true);
    });
    return () => { active = false; };
  }, [documentType, documentId]);

  async function handleDownload(attachment) {
    setDownloadingId(attachment.id);
    setError('');
    const result = await downloadCustomerDocumentAttachment(attachment);
    setDownloadingId(null);
    if (result.error) setError(result.error.message ?? 'ดาวน์โหลดไฟล์ไม่สำเร็จ');
  }

  if (!loaded) return null;
  if (!attachments.length && !showWhenEmpty && !error) return null;

  return (
    <div className="table-card" data-testid="r3-attachment-download-panel">
      <div className="table-card-header">
        <h3>เอกสาร ร.3 ที่แนบไว้</h3>
      </div>
      <div className="customer-attachment-panel" style={{ margin: '0 20px 20px' }}>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <ul className="customer-attachment-list" data-testid="r3-attachment-download-list">
          {attachments.map((file) => (
            <li key={file.id}>
              <span>{file.file_name} ({formatAttachmentSize(file.file_size_bytes)})</span>
              <span className="form-helper" style={{ margin: 0 }}>
                อัปโหลดโดย {describeAttachmentUploader(file)}
                {file.uploaded_at ? ` · ${formatDocumentDate(file.uploaded_at)}` : ''}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                data-testid="r3-attachment-download-button"
                disabled={downloadingId === file.id}
                onClick={() => handleDownload(file)}
                type="button"
              >
                <Download size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {downloadingId === file.id ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด'}
              </button>
            </li>
          ))}
          {!attachments.length ? (
            <li><span className="form-helper">ยังไม่มีไฟล์ใบ ร.3 แนบไว้</span></li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { recallCustomerDepositRequest } from '../../services/customerDepositRequestService.js';

const REASON_LABELS = {
  customer_request_recall_role_denied: 'บทบาทของคุณไม่สามารถเรียกเอกสารกลับได้',
  customer_request_recall_status_denied: 'เรียกเอกสารกลับได้เฉพาะก่อนที่จะเปิดใบงาน (สถานะ "รอตรวจสอบ" หรือ "อยู่ระหว่างตรวจสอบ" เท่านั้น)',
};

// Lets the customer pull a submitted deposit request back to DRAFT for
// editing — only while it's still awaiting admin review, before the
// warehouse-side receiving document gets created (see
// tgd_recall_customer_deposit_request / getDepositRecallEligibility).
export function CustomerRequestRecallPanel({
  requestId,
  eligibility,
  onRecalled,
  testId = 'customer-request-recall-panel',
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!eligibility?.canRecall) {
    if (!eligibility?.reasonKey) return null;
    return (
      <div className="banner banner-warning" data-testid={`${testId}-blocked`} role="status">
        {REASON_LABELS[eligibility.reasonKey] ?? eligibility.reasonKey}
      </div>
    );
  }

  async function handleRecall() {
    if (!requestId) return;
    if (!window.confirm('ต้องการเรียกเอกสารกลับมาแก้ไขใช่หรือไม่?\nสถานะเอกสารจะกลับเป็น "ร่าง" และหลุดออกจากคิวตรวจสอบของเจ้าหน้าที่จนกว่าจะส่งใหม่')) return;

    setSubmitting(true);
    setError('');
    const result = await recallCustomerDepositRequest(requestId);
    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'เรียกเอกสารกลับไม่สำเร็จ');
      return;
    }

    onRecalled?.(result.data);
  }

  return (
    <div className="action-row" data-testid={testId}>
      {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 8 }}>{error}</div> : null}
      <button
        className="btn btn-secondary"
        data-testid={`${testId}-button`}
        disabled={submitting}
        onClick={handleRecall}
        type="button"
        title="ดึงเอกสารกลับมาเป็นร่างเพื่อแก้ไข ก่อนที่เจ้าหน้าที่จะเปิดใบงาน"
      >
        {submitting ? 'กำลังเรียกเอกสารกลับ...' : '↩ เรียกเอกสารกลับ'}
      </button>
    </div>
  );
}

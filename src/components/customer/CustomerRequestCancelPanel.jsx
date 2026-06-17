import { useState } from 'react';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { cancelCustomerDepositRequest } from '../../services/customerDepositRequestService.js';
import { cancelCustomerWithdrawalRequest } from '../../services/customerWithdrawalRequestService.js';

export function CustomerRequestCancelPanel({
  requestType,
  requestId,
  eligibility,
  onCancelled,
  testId = 'customer-request-cancel-panel',
}) {
  const t = useTranslation();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!eligibility?.canCancel) {
    if (!eligibility?.reasonKey) return null;

    const reason = eligibility.reasonKey === 'customer_request_cancel_lead_time'
      ? t('customer_request_cancel_lead_time').replace('{days}', String(eligibility.leadDays ?? 0))
      : t(eligibility.reasonKey);

    return (
      <div className="banner banner-warning" data-testid={`${testId}-blocked`} role="status">
        {reason}
      </div>
    );
  }

  async function handleCancel() {
    if (!requestId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    const result = requestType === 'withdrawal'
      ? await cancelCustomerWithdrawalRequest(requestId, comment)
      : await cancelCustomerDepositRequest(requestId, comment);

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? t('customer_request_cancel_failed'));
      return;
    }

    setSuccess(t('customer_request_cancel_success'));
    onCancelled?.(result.data);
  }

  return (
    <div className="form-card customer-request-cancel-panel" data-testid={testId}>
      <h3>{t('customer_request_cancel_title')}</h3>
      <p className="form-helper">{t('customer_request_cancel_description')}</p>
      <label className="form-field">
        <span>{t('customer_request_cancel_comment')}</span>
        <textarea
          className="form-control"
          data-testid={`${testId}-comment`}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          value={comment}
        />
      </label>
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}
      <div className="action-row">
        <button
          className="btn btn-secondary"
          data-testid={`${testId}-button`}
          disabled={submitting}
          onClick={handleCancel}
          type="button"
        >
          {submitting ? t('customer_request_cancel_submitting') : t('customer_request_cancel_button')}
        </button>
      </div>
    </div>
  );
}

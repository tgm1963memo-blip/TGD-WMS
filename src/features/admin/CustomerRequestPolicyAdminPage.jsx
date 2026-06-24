import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getCustomerRequestPolicy, updateCustomerRequestPolicy } from '../../services/customerRequestPolicyService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerRequestPolicyAdminPage() {
  const t = useTranslation();
  const [depositLeadDays, setDepositLeadDays] = useState('3');
  const [withdrawalLeadDays, setWithdrawalLeadDays] = useState('3');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);

    getCustomerRequestPolicy().then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error.message ?? 'ไม่สามารถโหลดข้อมูลนโยบายได้');
      } else if (result.data) {
        setDepositLeadDays(String(result.data.deposit_cancel_lead_days ?? 3));
        setWithdrawalLeadDays(String(result.data.withdrawal_cancel_lead_days ?? 3));
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const result = await updateCustomerRequestPolicy({
      depositCancelLeadDays: Number(depositLeadDays),
      withdrawalCancelLeadDays: Number(withdrawalLeadDays),
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? t('customer_request_policy_save_error'));
      return;
    }

    setSuccess(t('customer_request_policy_save_success'));
    if (result.data) {
      setDepositLeadDays(String(result.data.deposit_cancel_lead_days ?? depositLeadDays));
      setWithdrawalLeadDays(String(result.data.withdrawal_cancel_lead_days ?? withdrawalLeadDays));
    }
  }

  if (loading) {
    return (
      <section className="page-shell" data-testid="customer-request-policy-admin-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  return (
    <section className="page-shell" data-testid="customer-request-policy-admin-page">
      <PageHeader
        title={t('customer_request_policy_title')}
        description={t('customer_request_policy_description')}
      />

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}

      <form className="form-card" onSubmit={handleSave}>
        <label className="form-field">
          <span>{t('customer_request_policy_deposit_lead_days')}</span>
          <input
            className="form-control"
            data-testid="customer-request-policy-deposit-lead-days"
            min="0"
            onChange={(event) => setDepositLeadDays(event.target.value)}
            required
            type="number"
            value={depositLeadDays}
          />
          <small className="form-helper">{t('customer_request_policy_deposit_lead_hint')}</small>
        </label>

        <label className="form-field">
          <span>{t('customer_request_policy_withdrawal_lead_days')}</span>
          <input
            className="form-control"
            data-testid="customer-request-policy-withdrawal-lead-days"
            min="0"
            onChange={(event) => setWithdrawalLeadDays(event.target.value)}
            required
            type="number"
            value={withdrawalLeadDays}
          />
          <small className="form-helper">{t('customer_request_policy_withdrawal_lead_hint')}</small>
        </label>

        <div className="action-row">
          <button className="btn btn-primary" data-testid="customer-request-policy-save-button" disabled={submitting} type="submit">
            {submitting ? t('customer_request_policy_saving') : t('customer_request_policy_save_button')}
          </button>
        </div>
      </form>
    </section>
  );
}

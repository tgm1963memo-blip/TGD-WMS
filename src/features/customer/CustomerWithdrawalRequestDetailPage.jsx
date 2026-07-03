import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerWithdrawalRequestLinesDisplay } from '../../components/customer/CustomerWithdrawalRequestLinesDisplay.jsx';
import { CustomerWithdrawalRequestPrintDocument } from '../../components/customer/CustomerWithdrawalRequestPrintDocument.jsx';
import { CustomerRequestCancelPanel } from '../../components/customer/CustomerRequestCancelPanel.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import {
  getCustomerWithdrawalRequest,
  listCustomerWithdrawalRequestLines,
} from '../../services/customerWithdrawalRequestService.js';
import { getCustomerRequestPolicy } from '../../services/customerRequestPolicyService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getWithdrawalCancelEligibility } from '../../utils/customerRequestCancelUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

export function CustomerWithdrawalRequestDetailPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { role, isRequestProxy } = useCustomerPortalProfile();
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!requestId) return undefined;

    setLoading(true);
    setError('');

    Promise.all([
      getCustomerWithdrawalRequest(requestId),
      listCustomerWithdrawalRequestLines(requestId),
      getCustomerRequestPolicy(),
    ]).then(([headerResult, linesResult, policyResult]) => {
      if (!active) return;

      if (headerResult.error || !headerResult.data) {
        setError(headerResult.error?.message ?? t('customer_request_detail_not_found'));
        setHeader(null);
        setLines([]);
      } else {
        setHeader(headerResult.data);
        setLines(linesResult.data ?? []);
      }

      setPolicy(policyResult.data ?? null);
      setLoading(false);
    }).catch((err) => {
      if (!active) return;
      setError(err?.message || t('customer_portal_load_error'));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [requestId, t]);

  if (loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-detail-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  if (!header) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-detail-page">
        <PageHeader
          title={t('customer_withdrawal_detail_title')}
          actions={(
            <Link className="btn btn-secondary" to="/customer/withdrawal-request">
              {t('customer_withdrawal_back_to_list')}
            </Link>
          )}
        />
        <div className="banner banner-danger" role="alert">{error || t('customer_request_detail_not_found')}</div>
      </section>
    );
  }

  const eligibility = getWithdrawalCancelEligibility(header, role, policy ?? undefined);
  const branding = getDocumentBrandingConfig();

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-detail-page">
      <PageHeader
        title={t('customer_withdrawal_detail_title')}
        description={header.withdrawal_no}
        actions={(
          <>
            {header.status === 'WITHDRAWAL_DRAFT' && (
              <Link className="btn btn-primary" to={`/customer/withdrawal-request/new?editId=${header.id}`}>
                แก้ไขร่าง
              </Link>
            )}
            <ReportPrintActions
              disabled={!header}
              orientation="landscape"
              renderReport={(reportLanguage) => (
                <CustomerWithdrawalRequestPrintDocument
                  branding={branding}
                  header={header}
                  language={reportLanguage}
                  lines={lines}
                  hideCustomerName={!isRequestProxy}
                />
              )}
              title={header.withdrawal_no}
            />
            <Link className="btn btn-secondary" data-testid="customer-withdrawal-detail-back" to="/customer/withdrawal-request">
              {t('customer_withdrawal_back_to_list')}
            </Link>
          </>
        )}
      />
      <CustomerPortalLiveBanner />

      <div className="table-card">
        <div className="table-card-header">
          <h3>{header.withdrawal_no}</h3>
          <span className={`status-badge status-badge--${getCustomerRequestStatusClass(header.status)}`}>
            {header.status}
          </span>
        </div>
        <div className="form-grid customer-request-detail-meta" style={{ padding: '8px 20px 24px', gap: 16 }}>
          <div><strong>{t('customer_field_requested_dispatch_date')}:</strong> {formatDocumentDate(header.requested_dispatch_date, { dateOnly: true })}</div>
          <div><strong>{t('customer_field_delivery_type')}:</strong> {header.delivery_type ?? '-'}</div>
          <div><strong>{t('customer_field_pickup_contact')}:</strong> {header.pickup_contact ?? '-'}</div>
          <div><strong>{t('customer_field_vehicle_registration')}:</strong> {header.vehicle_registration || '-'}</div>
          <div><strong>{t('customer_col_note')}:</strong> {header.note || '-'}</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_withdrawal_lines_title')}</h3>
        </div>
        <CustomerWithdrawalRequestLinesDisplay lines={lines} />
      </div>

      <CustomerRequestCancelPanel
        eligibility={eligibility}
        onCancelled={() => navigate('/customer/withdrawal-request')}
        requestId={requestId}
        requestType="withdrawal"
        testId="customer-withdrawal-cancel-panel"
      />
    </section>
  );
}

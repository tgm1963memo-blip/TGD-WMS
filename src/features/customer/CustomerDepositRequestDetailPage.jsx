import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerDepositRequestLinesDisplay } from '../../components/customer/CustomerDepositRequestLinesDisplay.jsx';
import { CustomerDepositRequestPrintDocument } from '../../components/customer/CustomerDepositRequestPrintDocument.jsx';
import { CustomerRequestCancelPanel } from '../../components/customer/CustomerRequestCancelPanel.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import {
  getCustomerDepositRequest,
  listCustomerDepositRequestLines,
} from '../../services/customerDepositRequestService.js';
import { getCustomerRequestPolicy } from '../../services/customerRequestPolicyService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getDepositCancelEligibility, hasWeightVariance } from '../../utils/customerRequestCancelUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

export function CustomerDepositRequestDetailPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { role } = useCustomerPortalProfile();
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
      getCustomerDepositRequest(requestId),
      listCustomerDepositRequestLines(requestId),
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
      <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-detail-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  if (!header) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-detail-page">
        <PageHeader
          title={t('customer_deposit_detail_title')}
          actions={(
            <Link className="btn btn-secondary" to="/customer/deposit-request">
              {t('customer_deposit_back_to_list')}
            </Link>
          )}
        />
        <div className="banner banner-danger" role="alert">{error || t('customer_request_detail_not_found')}</div>
      </section>
    );
  }

  const eligibility = getDepositCancelEligibility(header, role, policy);
  const branding = getDocumentBrandingConfig();
  const hasActualReceipt = lines.some((l) => l.actual_boxes != null || l.actual_weight != null);
  const allReceived = lines.length > 0 && lines.every((l) => l.actual_boxes != null);
  const hasVariance = lines.some((l) =>
    l.actual_boxes != null && (l.actual_boxes !== l.expected_boxes || hasWeightVariance(l.actual_weight, l.expected_weight))
  );

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-detail-page">
      <PageHeader
        title={t('customer_deposit_detail_title')}
        description={header.request_no}
        actions={(
          <>
            {(header.status === 'DRAFT' || header.status === 'DEPOSIT_DRAFT') && (
              <Link className="btn btn-primary" to={`/customer/deposit-request/new?editId=${header.id}`}>
                แก้ไขร่าง
              </Link>
            )}
            <ReportPrintActions
              disabled={!header}
              orientation="landscape"
              renderReport={(reportLanguage) => (
                <CustomerDepositRequestPrintDocument
                  branding={branding}
                  header={header}
                  language={reportLanguage}
                  lines={lines}
                />
              )}
              title={header.request_no}
            />
            <Link className="btn btn-secondary" data-testid="customer-deposit-detail-back" to="/customer/deposit-request">
              {t('customer_deposit_back_to_list')}
            </Link>
          </>
        )}
      />
      <CustomerPortalLiveBanner />

      <div className="table-card">
        <div className="table-card-header">
          <h3>{header.request_no}</h3>
          <span className={`status-badge status-badge--${getCustomerRequestStatusClass(header.status)}`}>
            {getDepositStatusLabel(header.status, t)}
          </span>
        </div>

        {/* Customer info */}
        {header.customer && (
          <div style={{ padding: '0 20px 12px', borderBottom: '1px solid var(--tgd-border)', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{header.customer.customer_name ?? header.customer.name ?? '-'}</div>
            {header.customer.address && (
              <div style={{ fontSize: 13, color: 'var(--tgd-muted-text)', marginTop: 2 }}>{header.customer.address}</div>
            )}
            {header.customer.phone && (
              <div style={{ fontSize: 13, color: 'var(--tgd-muted-text)' }}>โทร: {header.customer.phone}</div>
            )}
          </div>
        )}

        {/* Receiving result banner */}
        {hasActualReceipt && (
          <div style={{ padding: '0 20px 12px' }}>
            {hasVariance ? (
              <div className="banner banner-warning" role="status" style={{ margin: 0 }}>
                ⚠️ ได้รับสินค้าไม่ครบทุกรายการ — มีส่วนต่างจากที่แจ้งฝาก
              </div>
            ) : allReceived ? (
              <div className="banner" role="status" style={{ margin: 0, background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46' }}>
                ✓ ได้รับสินค้าครบทุกจำนวน
              </div>
            ) : (
              <div className="banner banner-info" role="status" style={{ margin: 0 }}>
                อยู่ระหว่างรับสินค้าเข้าคลัง...
              </div>
            )}
          </div>
        )}

        <div className="form-grid customer-request-detail-meta" style={{ padding: '8px 20px 24px', gap: 16 }}>
          <div><strong>{t('customer_field_expected_arrival_date')}:</strong> {formatDocumentDate(header.expected_arrival_date, { dateOnly: true })}</div>
          <div><strong>{t('customer_field_arrival_time')}:</strong> {header.arrival_time ?? '-'}</div>
          <div><strong>{t('customer_field_contact_name')}:</strong> {header.contact_name ?? '-'}</div>
          <div><strong>{t('customer_field_contact_phone')}:</strong> {header.contact_phone ?? '-'}</div>
          <div><strong>{t('customer_field_vehicle_registration')}:</strong> {header.vehicle_registration ?? '-'}</div>
          <div><strong>{t('customer_col_note')}:</strong> {header.note || '-'}</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_deposit_lines_title')}</h3>
        </div>
        <CustomerDepositRequestLinesDisplay lines={lines} />
      </div>

      <CustomerRequestCancelPanel
        eligibility={eligibility}
        onCancelled={() => navigate('/customer/deposit-request')}
        requestId={requestId}
        requestType="deposit"
        testId="customer-deposit-cancel-panel"
      />
    </section>
  );
}

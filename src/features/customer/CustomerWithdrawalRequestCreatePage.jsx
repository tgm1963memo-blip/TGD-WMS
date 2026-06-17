import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerProcessTimeline } from '../../components/customer/CustomerProcessTimeline.jsx';
import { CustomerWithdrawalLinesTable } from '../../components/customer/CustomerWithdrawalLinesTable.jsx';
import { CUSTOMER_WITHDRAWAL_STATUSES } from '../../data/customerPortalDemoData.js';
import {
  createCustomerWithdrawalRequest,
  getCustomerWithdrawalRequest,
  listCustomerWithdrawalRequestLines,
  upsertCustomerWithdrawalRequestLine,
} from '../../services/customerWithdrawalRequestService.js';
import { listCustomerDepositRequests } from '../../services/customerDepositRequestService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import {
  mapWithdrawalHeaderForCopy,
  mapWithdrawalLinesForCopy,
} from '../../utils/customerRequestCopyUtils.js';
import {
  createEmptyWithdrawalLine,
  createInitialWithdrawalLines,
  getFilledWithdrawalLines,
  WITHDRAWAL_LINE_DEFAULT_COUNT,
} from '../../utils/customerWithdrawalLineDefaults.js';
import { CustomerRequestCustomerPicker } from '../../components/customer/CustomerRequestCustomerPicker.jsx';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_HEADER = {
  requested_dispatch_date: '',
  delivery_type: 'PICKUP',
  pickup_contact: '',
  destination: '',
  note: '',
};

export function CustomerWithdrawalRequestCreatePage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get('copyFrom');
  const { customerId, canWriteCustomerRequests, isRequestProxy } = useCustomerPortalProfile();
  const [proxyCustomerId, setProxyCustomerId] = useState('');
  const effectiveCustomerId = isRequestProxy ? proxyCustomerId : customerId;
  const [header, setHeader] = useState(INITIAL_HEADER);
  const [lines, setLines] = useState(() => createInitialWithdrawalLines());
  const [nextLineKey, setNextLineKey] = useState(WITHDRAWAL_LINE_DEFAULT_COUNT + 1);
  const [depositOptions, setDepositOptions] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copySourceNo, setCopySourceNo] = useState('');
  const [copyLoading, setCopyLoading] = useState(Boolean(copyFromId));
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    let active = true;

    if (!copyFromId) {
      setCopyLoading(false);
      setCopySourceNo('');
      setCopyError('');
      return undefined;
    }

    setCopyLoading(true);
    setCopyError('');

    (async () => {
      const headerResult = await getCustomerWithdrawalRequest(copyFromId);
      if (!active) return;

      if (headerResult.error || !headerResult.data) {
        setCopyError(headerResult.error?.message ?? t('customer_request_copy_error'));
        setCopyLoading(false);
        return;
      }

      if (isRequestProxy) {
        setProxyCustomerId(headerResult.data.customer_id ?? '');
      }

      const sourceCustomerId = headerResult.data.customer_id;
      const [linesResult, catalogResult] = await Promise.all([
        listCustomerWithdrawalRequestLines(copyFromId),
        listCustomerProducts({ customerId: sourceCustomerId, activeOnly: true }),
      ]);

      if (!active) return;

      if (linesResult.error) {
        setCopyError(linesResult.error.message ?? t('customer_request_copy_error'));
        setCopyLoading(false);
        return;
      }

      const copiedLines = mapWithdrawalLinesForCopy(linesResult.data ?? [], catalogResult.data ?? []);
      setCopySourceNo(headerResult.data.withdrawal_no ?? copyFromId);
      setHeader(mapWithdrawalHeaderForCopy(headerResult.data));
      setLines(copiedLines);
      setNextLineKey(copiedLines.length + 1);
      setCopyLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [copyFromId, isRequestProxy, t]);

  useEffect(() => {
    let active = true;
    if (!effectiveCustomerId) {
      setDepositOptions([]);
      return undefined;
    }

    listCustomerDepositRequests({ customerId: effectiveCustomerId }).then((result) => {
      if (!active) return;
      setDepositOptions(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [effectiveCustomerId]);

  if (copyLoading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-create-page">
        <LoadingState message={t('customer_request_copy_loading')} />
      </section>
    );
  }

  function updateHeaderField(field, value) {
    setHeader((current) => ({ ...current, [field]: value }));

    setSubmitError('');
  }

  function addLine() {
    setLines((current) => [...current, createEmptyWithdrawalLine(nextLineKey)]);
    setNextLineKey((current) => current + 1);

    setSubmitError('');
  }

  function removeLine(lineKey) {
    setLines((current) => {
      if (current.length <= 1) return current;
      return current.filter((line) => line.key !== lineKey);
    });

    setSubmitError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');


    if (!canWriteCustomerRequests) {
      setSubmitError(t('customer_portal_no_customer_scope'));
      return;
    }

    if (isRequestProxy && !proxyCustomerId) {
      setSubmitError(t('customer_request_proxy_customer_required'));
      return;
    }

    const activeLines = getFilledWithdrawalLines(lines);
    if (!activeLines.length) {
      setSubmitError(t('customer_deposit_catalog_required'));
      return;
    }

    setSubmitting(true);

    const createResult = await createCustomerWithdrawalRequest({
      requestedDispatchDate: header.requested_dispatch_date,
      deliveryType: header.delivery_type,
      pickupContact: header.pickup_contact,
      destination: header.destination,
      note: header.note,
      customerId: isRequestProxy ? proxyCustomerId : null,
    });

    if (createResult.error) {
      setSubmitting(false);
      setSubmitError(createResult.error.message ?? t('customer_portal_load_error'));
      return;
    }

    const requestId = createResult.data?.id;

    for (let index = 0; index < activeLines.length; index += 1) {
      const line = activeLines[index];
      const lineResult = await upsertCustomerWithdrawalRequestLine(requestId, {
        lineNo: index + 1,
        sourceDepositRequestId: line.source_deposit_request_id || null,
        sourceLotNo: line.lot_no,
        customerProductCode: line.customer_product_code,
        internalProductCode: line.product_code,
        productName: line.product_name,
        lotNo: line.lot_no,
        mfgDate: line.mfg_date || null,
        expDate: line.exp_date || null,
        requestedQty: line.requested_qty,
        requestedBoxes: line.requested_boxes,
        requestedWeight: line.requested_weight,
        pickingRule: line.picking_rule,
        note: header.note,
      });

      if (lineResult.error) {
        setSubmitting(false);
        setSubmitError(lineResult.error.message ?? t('customer_portal_load_error'));
        return;
      }
    }

    setSubmitting(false);
    navigate('/customer/withdrawal-request');
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-create-page">
      <PageHeader
        title={t('customer_withdrawal_create_title')}
        description={t('customer_withdrawal_description')}
        actions={(
          <Link className="btn btn-secondary" data-testid="customer-withdrawal-back-to-list" to="/customer/withdrawal-request">
            {t('customer_withdrawal_back_to_list')}
          </Link>
        )}
      />
      <CustomerPortalLiveBanner />

      <p className="form-helper" data-testid="customer-withdrawal-auto-number-hint">{t('customer_request_auto_number_hint')}</p>

      {copySourceNo ? (
        <div className="banner banner-info" data-testid="customer-withdrawal-copy-banner" role="status">
          {t('customer_request_copy_banner').replace('{sourceNo}', copySourceNo)}
        </div>
      ) : null}

      {copyError ? (
        <div className="banner banner-danger" role="alert">{copyError}</div>
      ) : null}

      <div className="customer-process-card">
        <h3>Withdrawal status timeline</h3>
        <CustomerProcessTimeline statuses={CUSTOMER_WITHDRAWAL_STATUSES} testId="customer-withdrawal-status-timeline" />
      </div>

      {submitError ? <div className="banner banner-danger" role="alert">{submitError}</div> : null}

      <form className="form-card customer-portal-form" data-testid="customer-withdrawal-request-form" onSubmit={handleSubmit}>
        {isRequestProxy ? (
          <CustomerRequestCustomerPicker
            onChange={setProxyCustomerId}
            testId="customer-withdrawal-proxy-customer-select"
            value={proxyCustomerId}
          />
        ) : null}

        <div className="customer-deposit-lines-panel">
          <div className="customer-deposit-lines-header">
            <h3>{t('customer_withdrawal_lines_title')}</h3>
            <div className="action-row">
              <button className="btn btn-secondary" data-testid="customer-withdrawal-add-line-button" onClick={addLine} type="button">
                {t('customer_deposit_add_line')}
              </button>
            </div>
          </div>

          <CustomerWithdrawalLinesTable
            customerId={effectiveCustomerId}
            depositOptions={depositOptions}
            lines={lines}
            onChange={setLines}
            onRemoveLine={removeLine}
          />
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>{t('customer_field_requested_dispatch_date')}</span>
            <input className="form-control" data-testid="customer-withdrawal-dispatch-date" onChange={(e) => updateHeaderField('requested_dispatch_date', e.target.value)} required type="date" value={header.requested_dispatch_date} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_delivery_type')}</span>
            <select className="form-control" onChange={(e) => updateHeaderField('delivery_type', e.target.value)} value={header.delivery_type}>
              <option value="PICKUP">PICKUP</option>
              <option value="DELIVERY">DELIVERY</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t('customer_field_pickup_contact')}</span>
            <input className="form-control" data-testid="customer-withdrawal-pickup-contact" onChange={(e) => updateHeaderField('pickup_contact', e.target.value)} required value={header.pickup_contact} />
          </label>
          <label className="form-field">
            <span>{t('customer_field_destination')}</span>
            <input className="form-control" onChange={(e) => updateHeaderField('destination', e.target.value)} value={header.destination} />
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('customer_field_note')}</span>
            <textarea className="form-control" onChange={(e) => updateHeaderField('note', e.target.value)} rows={3} value={header.note} />
          </label>
        </div>
        <div className="action-row customer-portal-form-actions">
          <Link className="btn btn-secondary" to="/customer/withdrawal-request">{t('close')}</Link>
          <button className="btn btn-primary" data-testid="customer-withdrawal-submit-button" disabled={submitting} type="submit">
            {submitting ? t('customer_withdrawal_submitting') : t('customer_withdrawal_submit')}
          </button>
        </div>
      </form>
    </section>
  );
}

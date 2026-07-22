import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState } from '../ui/LoadingState.jsx';
import { listCustomerWithdrawalRequests, listCustomerWithdrawalRequestLines } from '../../services/customerWithdrawalRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { buildCustomerRequestCopyPath } from '../../utils/customerRequestCopyUtils.js';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { CustomerWithdrawalRequestPrintDocument } from './CustomerWithdrawalRequestPrintDocument.jsx';
import { ReportPrintActions } from '../reports/ReportPrintActions.jsx';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { mergeWithdrawalRequestsForPrint } from '../../utils/mergeRequestLinesForPrint.js';

const ALL_WITHDRAWAL_STATUSES = [
  'WITHDRAWAL_DRAFT',
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_PICKING',
  'REJECTED',
  'COMPLETED',
  'DISPATCHED',
];

// Requests can only be combined into one printed work order while their
// work order is still active — same set already used for this exact
// purpose on the admin withdrawal review page.
const BULK_PRINT_ELIGIBLE_STATUSES = ['ADMIN_ACCEPTED', 'WAREHOUSE_PICKING'];

export function CustomerWithdrawalNotificationsSection({
  testId = 'withdrawal-customer-withdrawal-section',
  showCustomerColumn = true,
  showCopyAction = true,
}) {
  const t = useTranslation();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [customerNames, setCustomerNames] = useState({});
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRequestIds, setSelectedRequestIds] = useState(() => new Set());
  const [mergedPrint, setMergedPrint] = useState(null);
  const [combining, setCombining] = useState(false);
  const [combineError, setCombineError] = useState('');

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listCustomerWithdrawalRequests().then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    if (showCustomerColumn) {
      getCustomers().then((result) => {
        if (!active) return;
        const names = {};
        (result.data ?? []).forEach((customer) => {
          names[customer.id] = customer.name ?? customer.code ?? customer.id;
        });
        setCustomerNames(names);
      });
    }

    return () => {
      active = false;
    };
  }, [showCustomerColumn]);

  function toggleRequestSelected(id) {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllRequests(candidateRows) {
    setSelectedRequestIds((prev) => {
      const selectableIds = candidateRows.map((r) => r.id);
      const allSelected = selectableIds.length > 0 && selectableIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(selectableIds);
    });
  }

  function clearMergedPrint() {
    setMergedPrint(null);
    setSelectedRequestIds(new Set());
    setCombineError('');
  }

  async function handleCombineSelected(selectedRequestRows) {
    if (selectedRequestRows.length < 2) return;
    setCombining(true);
    setCombineError('');
    const results = await Promise.all(selectedRequestRows.map((r) => listCustomerWithdrawalRequestLines(r.id)));
    const failed = results.find((r) => r.error);
    if (failed) {
      setCombineError(failed.error.message ?? 'โหลดรายการไม่สำเร็จ');
      setCombining(false);
      return;
    }
    const entries = selectedRequestRows.map((r, i) => ({
      header: {
        ...r,
        customer_name: r.customer?.customer_name || r.customer?.name || null,
      },
      lines: results[i].data ?? [],
    }));
    setMergedPrint(mergeWithdrawalRequestsForPrint(entries));
    setCombining(false);
  }

  if (state.loading) {
    return <LoadingState message={t('customer_portal_loading')} />;
  }

  const filteredRows = state.rows.filter((row) => {
    const text = filterText.toLowerCase();
    const matchText = !text ||
      (row.withdrawal_no ?? '').toLowerCase().includes(text) ||
      (row.pickup_contact ?? '').toLowerCase().includes(text) ||
      (customerNames[row.customer_id] ?? '').toLowerCase().includes(text);
    const matchStatus = !filterStatus || row.status === filterStatus;
    return matchText && matchStatus;
  });

  const columnCount = 9 + (showCustomerColumn ? 1 : 0) + (showCopyAction ? 1 : 0);
  const bulkEligibleRows = filteredRows.filter((r) => BULK_PRINT_ELIGIBLE_STATUSES.includes(r.status));
  const selectedRequestRows = filteredRows
    .filter((r) => selectedRequestIds.has(r.id))
    .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
  const hasCustomerMismatch = new Set(selectedRequestRows.map((r) => r.customer_id)).size > 1;
  const branding = getDocumentBrandingConfig();

  return (
    <section className="table-card customer-withdrawal-notifications-section" data-testid={testId}>
      <div className="table-card-header">
        <h3>{t('withdrawal_customer_withdrawal_section_title')}</h3>
        <span className="form-helper">{t('withdrawal_customer_withdrawal_section_hint')}</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 16px' }}>
        <label className="form-label" style={{ margin: 0, flex: '1 1 200px' }}>
          {'ค้นหา'}
          <input
            className="form-control"
            type="search"
            placeholder="เลขที่คำขอ / ผู้ติดต่อ / ลูกค้า"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 180px' }}>
          {'สถานะ'}
          <select
            className="form-control"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            {ALL_WITHDRAWAL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        {(filterText || filterStatus) ? (
          <button
            type="button"
            className="btn"
            onClick={() => { setFilterText(''); setFilterStatus(''); }}
            style={{ alignSelf: 'flex-end', background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}
          >
            {'ล้างตัวกรอง'}
          </button>
        ) : null}
      </div>

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      {selectedRequestIds.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid var(--tgd-border)' }}>
          <span>{selectedRequestIds.size} รายการที่เลือก</span>
          {hasCustomerMismatch && (
            <span className="banner banner-danger" style={{ padding: '2px 8px' }}>ไม่สามารถรวมเอกสารจากลูกค้าต่างกันได้</span>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={selectedRequestRows.length < 2 || hasCustomerMismatch || combining}
            onClick={() => handleCombineSelected(selectedRequestRows)}
          >
            {combining ? 'กำลังรวม...' : 'รวมเป็นใบงานเดียว'}
          </button>
          <button type="button" className="btn btn-sm" onClick={clearMergedPrint}>ล้างการเลือก</button>
          {combineError && <span className="banner banner-danger" style={{ padding: '2px 8px' }}>{combineError}</span>}
        </div>
      )}
      {mergedPrint && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--tgd-border)' }}>
          <ReportPrintActions
            disabled={false}
            orientation="landscape"
            title={`${mergedPrint.header.withdrawal_no} — ${t('withdrawal_review_customer_button')}`}
            renderReport={(language) => (
              <CustomerWithdrawalRequestPrintDocument
                branding={branding}
                header={mergedPrint.header}
                isStaff
                language={language}
                lines={mergedPrint.lines}
              />
            )}
          />
        </div>
      )}

      <div className="responsive-table">
        <table className="data-table" data-testid="withdrawal-customer-withdrawal-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="เลือกทั้งหมด"
                  checked={bulkEligibleRows.length > 0 && bulkEligibleRows.every((r) => selectedRequestIds.has(r.id))}
                  onChange={() => toggleSelectAllRequests(bulkEligibleRows)}
                />
              </th>
              <th>{t('customer_col_request_no')}</th>
              {showCustomerColumn ? <th>{t('customer_col_customer_name')}</th> : null}
              <th>{t('customer_col_status')}</th>
              <th>{t('customer_field_requested_dispatch_date')}</th>
              <th>{t('customer_field_delivery_type')}</th>
              <th>{t('customer_field_pickup_contact')}</th>
              <th>{t('customer_col_note')}</th>
              <th>{t('customer_history_latest_action')}</th>
              <th>{t('catalog_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`เลือก ${row.withdrawal_no}`}
                    disabled={!BULK_PRINT_ELIGIBLE_STATUSES.includes(row.status)}
                    checked={selectedRequestIds.has(row.id)}
                    onChange={() => toggleRequestSelected(row.id)}
                  />
                </td>
                <td>{row.withdrawal_no}</td>
                {showCustomerColumn ? <td>{customerNames[row.customer_id] ?? row.customer_id ?? '-'}</td> : null}
                <td>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{formatDocumentDate(row.requested_dispatch_date, { dateOnly: true })}</td>
                <td>{row.delivery_type ?? '-'}</td>
                <td>{row.pickup_contact ?? '-'}</td>
                <td>{row.note || '-'}</td>
                <td>
                  <small>{formatDocumentDate(row.last_action_at)}</small>
                </td>
                <td>
                  <div className="action-row">
                    <Link
                      className="btn btn-secondary btn-sm"
                      data-testid={`withdrawal-review-customer-${row.id}`}
                      to="/customer/admin/withdrawal-review"
                    >
                      {t('withdrawal_review_customer_button')}
                    </Link>
                    {showCopyAction ? (
                      <Link
                        className="btn btn-secondary btn-sm"
                        data-testid={`withdrawal-copy-customer-${row.id}`}
                        to={buildCustomerRequestCopyPath('/customer/withdrawal-request/new', row.id)}
                      >
                        {t('customer_request_copy_button')}
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={columnCount}>
                  {filterText || filterStatus
                    ? 'ไม่พบรายการที่ตรงกับเงื่อนไข'
                    : t('withdrawal_customer_withdrawal_empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

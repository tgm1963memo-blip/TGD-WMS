import { useEffect, useRef, useState } from 'react';
import { LoadingState } from '../ui/LoadingState.jsx';
import { listCustomerDepositRequests, listCustomerDepositRequestLines } from '../../services/customerDepositRequestService.js';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { CustomerDepositDetailModal } from './CustomerDepositDetailModal.jsx';
import { CustomerDepositStaffWorkOrderPrint } from './CustomerDepositStaffWorkOrderPrint.jsx';
import { ReportPrintActions } from '../reports/ReportPrintActions.jsx';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { mergeDepositRequestsForPrint } from '../../utils/mergeRequestLinesForPrint.js';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

const WAREHOUSE_DEPOSIT_STATUSES = [
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_RECEIVING',
  'PALLETIZING',
  'COUNT_VARIANCE_REVIEW',
  'ADMIN_RECOUNT_REQUESTED',
  'RECEIVED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
];

// Requests can only be combined into one printed work order while their
// work order is still active/not yet confirmed — mirrors the same status
// set used for bulk-print eligibility on the admin deposit review page.
const BULK_PRINT_ELIGIBLE_STATUSES = ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'];

export function CustomerDepositNotificationsSection({ testId = 'receiving-customer-deposit-section' }) {
  const t = useTranslation();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState(() => new Set());
  const [mergedPrint, setMergedPrint] = useState(null);
  const [combining, setCombining] = useState(false);
  const [combineError, setCombineError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listCustomerDepositRequests({ statusIn: WAREHOUSE_DEPOSIT_STATUSES }).then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => {
      active = false;
    };
  }, []);

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
    const results = await Promise.all(selectedRequestRows.map((r) => listCustomerDepositRequestLines(r.id)));
    if (!isMountedRef.current) return;
    const failed = results.find((r) => r.error);
    if (failed) {
      setCombineError(failed.error.message ?? 'โหลดรายการไม่สำเร็จ');
      setCombining(false);
      return;
    }
    // A request that legitimately contributes 0 lines (no query error, just
    // an empty array) would otherwise merge silently — the combined header
    // would still claim "รวมจากเอกสาร N ใบ" while the line table undercounts
    // by whichever document that was, with nothing telling staff why.
    const emptyIndex = results.findIndex((r) => (r.data ?? []).length === 0);
    if (emptyIndex !== -1) {
      const emptyRequest = selectedRequestRows[emptyIndex];
      setCombineError(`เอกสาร ${emptyRequest.request_no ?? emptyRequest.id} ไม่มีรายการสินค้า — กรุณาเอาออกจากการเลือกก่อนรวม`);
      setCombining(false);
      return;
    }
    const entries = selectedRequestRows.map((r, i) => ({
      header: {
        ...r,
        customer_name: r.customer?.customer_name || r.customer?.name || null,
        customer_address: r.customer?.address ?? null,
        contact_fax: r.customer?.fax ?? null,
      },
      lines: results[i].data ?? [],
    }));
    setMergedPrint(mergeDepositRequestsForPrint(entries));
    setCombining(false);
  }

  if (state.loading) {
    return <LoadingState message={t('customer_portal_loading')} />;
  }

  const customerOptions = [...new Map(
    state.rows
      .map((r) => ({ id: r.customer_id, name: r.customer?.customer_name || r.customer?.name || r.customer_id }))
      .filter((c) => c.id)
      .map((c) => [c.id, c])
  ).values()];

  const filteredRows = state.rows.filter((row) => {
    const text = filterText.toLowerCase();
    const matchText = !text ||
      (row.request_no ?? '').toLowerCase().includes(text) ||
      (row.contact_name ?? '').toLowerCase().includes(text);
    const matchStatus = !filterStatus || row.status === filterStatus;
    const matchCustomer = !filterCustomer || row.customer_id === filterCustomer;
    const arrivalDate = row.expected_arrival_date ?? '';
    const matchDateFrom = !filterDateFrom || arrivalDate >= filterDateFrom;
    const matchDateTo = !filterDateTo || arrivalDate <= filterDateTo;
    return matchText && matchStatus && matchCustomer && matchDateFrom && matchDateTo;
  });

  const bulkEligibleRows = filteredRows.filter((r) => BULK_PRINT_ELIGIBLE_STATUSES.includes(r.status));
  const selectedRequestRows = filteredRows
    .filter((r) => selectedRequestIds.has(r.id))
    .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
  const hasCustomerMismatch = new Set(selectedRequestRows.map((r) => r.customer_id)).size > 1;
  const branding = getDocumentBrandingConfig();

  return (
    <section className="table-card customer-deposit-notifications-section" data-testid={testId}>
      <div className="table-card-header">
        <h3>{t('receiving_customer_deposit_section_title')}</h3>
        <span className="form-helper">{t('receiving_customer_deposit_section_hint')}</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '16px 20px' }}>
        <label className="form-label" style={{ margin: 0, flex: '1 1 200px', maxWidth: 300 }}>
          {'ค้นหา'}
          <input
            className="form-control"
            type="search"
            placeholder="เลขที่คำขอ / ชื่อผู้ติดต่อ"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 180px', maxWidth: 240 }}>
          {'ลูกค้า'}
          <select
            className="form-control"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
          >
            <option value="">-- ลูกค้าทุกราย --</option>
            {customerOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 160px', maxWidth: 220 }}>
          {'สถานะ'}
          <select
            className="form-control"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            {WAREHOUSE_DEPOSIT_STATUSES.map((s) => (
              <option key={s} value={s}>{getDepositStatusLabel(s, t)}</option>
            ))}
          </select>
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}>
          {'วันที่แจ้งฝาก (ตั้งแต่)'}
          <input
            className="form-control"
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}>
          {'วันที่แจ้งฝาก (ถึง)'}
          <input
            className="form-control"
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </label>
        {(filterText || filterStatus || filterCustomer || filterDateFrom || filterDateTo) ? (
          <button
            type="button"
            className="btn"
            onClick={() => { setFilterText(''); setFilterStatus(''); setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
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
            title={`${mergedPrint.header.request_no} — ${t('receiving_review_deposit_button')}`}
            renderReport={(language) => (
              <CustomerDepositStaffWorkOrderPrint
                branding={branding}
                header={mergedPrint.header}
                language={language}
                lines={mergedPrint.lines}
              />
            )}
          />
        </div>
      )}

      <div className="responsive-table">
        <table className="data-table" data-testid="receiving-customer-deposit-table">
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
              <th>{t('customer_col_customer_name') ?? 'ลูกค้า'}</th>
              <th>{t('customer_col_status')}</th>
              <th>{t('customer_field_expected_arrival_date')}</th>
              <th>{t('customer_field_contact_name')}</th>
              <th>{t('customer_field_contact_phone')}</th>
              <th>{t('customer_col_note')}</th>
              <th>{t('catalog_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`เลือก ${row.request_no}`}
                    disabled={!BULK_PRINT_ELIGIBLE_STATUSES.includes(row.status)}
                    checked={selectedRequestIds.has(row.id)}
                    onChange={() => toggleRequestSelected(row.id)}
                  />
                </td>
                <td>
                  <a className="table-action-link" href={`/customer/deposit-request/${row.id}`} onClick={(e) => {
                    e.preventDefault();
                    setDetailId(row.id);
                  }}>{row.request_no}</a>
                </td>
                <td>{row.customer?.customer_name || row.customer?.name || row.customer_id || '-'}</td>
                <td>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {getDepositStatusLabel(row.status, t)}
                  </span>
                </td>
                <td>{formatDocumentDate(row.expected_arrival_date, { dateOnly: true })}</td>
                <td>{row.contact_name ?? '-'}</td>
                <td>{row.contact_phone ?? '-'}</td>
                <td>{row.note || '-'}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    data-testid={`receiving-review-deposit-${row.id}`}
                    type="button"
                    onClick={() => setDetailId(row.id)}
                  >
                    {t('receiving_review_deposit_button')}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9}>
                  {filterText || filterStatus
                    ? 'ไม่พบรายการที่ตรงกับเงื่อนไข'
                    : t('receiving_customer_deposit_empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerDepositDetailModal
        requestId={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onStatusChange={(id, newStatus) => {
          setState((prev) => ({
            ...prev,
            rows: prev.rows.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
          }));
        }}
      />
    </section>
  );
}

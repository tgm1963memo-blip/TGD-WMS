import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useState } from 'react';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerWithdrawalRequestPrintDocument } from '../../components/customer/CustomerWithdrawalRequestPrintDocument.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getWithdrawalStatusLabel, getLinePickingStatus } from '../../utils/customerWithdrawalStatusLabels.js';
import {
  listCustomerWithdrawalRequests,
  listCustomerWithdrawalRequestLines,
  reviewCustomerWithdrawalRequest,
  cancelCustomerWithdrawalRequest,
  enqueueCustomerWithdrawalNotification,
  recordWithdrawalLinePick,
  updateWithdrawalLineAdminNote,
} from '../../services/customerWithdrawalRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

const REVIEW_STATUSES = ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED', 'WAREHOUSE_PICKING', 'COMPLETED', 'DISPATCHED', 'REJECTED', 'CANCELLED'];

export function CustomerAdminWithdrawalReviewPage() {
  const t = useTranslation();
  const [rows, setRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelComment, setCancelComment] = useState('');
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyNote, setNotifyNote] = useState('');
  const [recountLine, setRecountLine] = useState(null);
  const [recountQty, setRecountQty] = useState('');
  const [recountBoxes, setRecountBoxes] = useState('');
  const [recountWeight, setRecountWeight] = useState('');
  const [recounting, setRecounting] = useState(false);
  const [lineAdminNotes, setLineAdminNotes] = useState({});
  const [savingAdminNote, setSavingAdminNote] = useState({});
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [globalSearchText, setGlobalSearchText] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const customerOptions = [...new Map(
    rows
      .map((r) => ({ id: r.customer_id, name: r.customer?.customer_name || r.customer?.name || r.customer_id }))
      .filter((c) => c.id)
      .map((c) => [c.id, c])
  ).values()];

  const filteredRows = rows.filter((row) => {
    if (globalSearchText) {
      const lower = globalSearchText.toLowerCase();
      const custName = row.customer?.customer_name || row.customer?.name || row.customer_id;
      const textMatch = (
        (row.withdrawal_no || '').toLowerCase().includes(lower) ||
        (row.status || '').toLowerCase().includes(lower) ||
        (row.delivery_type || '').toLowerCase().includes(lower) ||
        (row.pickup_contact || '').toLowerCase().includes(lower) ||
        (row.destination || '').toLowerCase().includes(lower) ||
        (custName || '').toLowerCase().includes(lower)
      );
      if (!textMatch) return false;
    }
    if (filterCustomer && row.customer_id !== filterCustomer) return false;
    const dispatchDate = row.requested_dispatch_date ?? '';
    if (filterDateFrom && dispatchDate && dispatchDate < filterDateFrom) return false;
    if (filterDateTo && dispatchDate && dispatchDate > filterDateTo) return false;
    return true;
  });

  const { sortedData, requestSort, getSortIndicator } = useTableSort(filteredRows);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listCustomerWithdrawalRequests({ statusIn: REVIEW_STATUSES }).then((result) => {
      if (!active) return;
      const data = result.data ?? [];
      setRows(data);
      const sorted = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setSelectedId(sorted[0]?.id ?? '');
      setLoading(false);
      setError(result.error?.message ?? '');
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedId) { setLines([]); return undefined; }

    listCustomerWithdrawalRequestLines(selectedId).then((result) => {
      if (!active) return;
      const loadedLines = result.data ?? [];
      setLines(loadedLines);
      const initNotes = {};
      loadedLines.forEach((l) => { initNotes[l.id] = l.admin_note ?? ''; });
      setLineAdminNotes(initNotes);
    });

    return () => { active = false; };
  }, [selectedId]);

  function openDetail(id) {
    setSelectedId(id);
    setComment('');
    setActionMsg('');
    setError('');
    setDetailOpen(true);
  }

  const selected = sortedData.find((row) => row.id === selectedId) ?? null;
  const branding = getDocumentBrandingConfig();

  const canOpenWorkOrder = selected && ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(selected.status);
  const canSendToHandheld = selected && selected.status === 'ADMIN_ACCEPTED';
  const canConfirmWithdrawal = selected && selected.status === 'WAREHOUSE_PICKING';
  const canReject = selected && !['ADMIN_REJECTED', 'REJECTED', 'COMPLETED', 'DISPATCHED', 'CANCELLED'].includes(selected.status);
  const canCancel = selected && !['COMPLETED', 'DISPATCHED', 'CANCELLED', 'REJECTED', 'ADMIN_REJECTED'].includes(selected.status);

  async function handleOpenWorkOrder() {
    if (!selectedId || !selected) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    // Step 1: REVIEWING — only if React state thinks it's still SUBMITTED_BY_CUSTOMER.
    // If DB has already moved to ADMIN_REVIEWING (stale React state), the call fails with
    // "ADMIN_REVIEWING" in the error message — we ignore that and continue to ACCEPT.
    if (selected.status === 'SUBMITTED_BY_CUSTOMER') {
      const reviewResult = await reviewCustomerWithdrawalRequest(selectedId, 'REVIEWING', comment);
      if (reviewResult.error) {
        const alreadyReviewing = reviewResult.error.message?.includes('ADMIN_REVIEWING');
        if (!alreadyReviewing) {
          setError(reviewResult.error.message ?? 'Review step failed');
          setSubmitting(false);
          return;
        }
      }
    }

    // Step 2: ACCEPT
    const acceptResult = await reviewCustomerWithdrawalRequest(selectedId, 'ACCEPT', comment);
    if (acceptResult.error) {
      setError(acceptResult.error.message ?? 'Open work order failed');
      setSubmitting(false);
      return;
    }

    // Step 3: SEND_TO_PICKING — auto-send to handheld immediately after accepting
    const pickResult = await reviewCustomerWithdrawalRequest(selectedId, 'SEND_TO_PICKING');
    setSubmitting(false);
    if (pickResult.error) {
      setError(pickResult.error.message ?? 'Send to handheld failed');
      setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: acceptResult.data?.status ?? 'ADMIN_ACCEPTED' } : r)));
      return;
    }
    const newStatus = pickResult.data?.status ?? 'WAREHOUSE_PICKING';
    setActionMsg(`${t('admin_work_order_opened')} — ${t('admin_sent_to_handheld')}`);
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
  }

  async function handleSendToHandheld() {
    if (!selectedId || !selected) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    const result = await reviewCustomerWithdrawalRequest(selectedId, 'SEND_TO_PICKING', comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Send to handheld failed');
      return;
    }
    const newStatus = result.data?.status ?? 'WAREHOUSE_PICKING';
    setActionMsg(t('admin_sent_to_handheld'));
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
  }

  async function handleConfirmWithdrawal() {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    const result = await reviewCustomerWithdrawalRequest(selectedId, 'CONFIRM_DISPATCH', comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Confirm withdrawal failed');
      return;
    }
    const newStatus = result.data?.status ?? 'COMPLETED';
    setActionMsg(t('admin_withdrawal_confirmed'));
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
    setNotifyNote('');
    setNotifyOpen(true);
  }

  async function handleReject() {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    const result = await reviewCustomerWithdrawalRequest(selectedId, 'REJECT', rejectReason || comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Reject failed');
      return;
    }
    const newStatus = result.data?.status ?? 'REJECTED';
    setActionMsg(getWithdrawalStatusLabel(newStatus, t) || newStatus);
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
    setRejectOpen(false);
    setRejectReason('');
  }

  async function handleCancel() {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    const result = await cancelCustomerWithdrawalRequest(selectedId, cancelComment || null);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Cancel failed');
      return;
    }
    const newStatus = result.data?.status ?? 'CANCELLED';
    setActionMsg('ยกเลิกเอกสารแล้ว');
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
    setCancelOpen(false);
    setCancelComment('');
  }

  async function handleSaveRecount() {
    if (!recountLine) return;
    setRecounting(true);
    setError('');
    const boxes = recountBoxes !== '' ? Number(recountBoxes) : null;
    const weight = recountWeight !== '' ? Number(recountWeight) : null;
    const result = await recordWithdrawalLinePick(recountLine.id, boxes, weight);
    setRecounting(false);
    if (result.error) {
      setError(result.error.message ?? 'บันทึกไม่สำเร็จ');
      return;
    }
    setLines((prev) => prev.map((l) =>
      l.id === recountLine.id
        ? { ...l, picked_boxes: boxes, picked_weight: weight }
        : l
    ));
    setActionMsg('บันทึกการตรวจนับเรียบร้อย');
    setRecountLine(null);
  }

  async function handleNotifyCustomer() {
    if (!selected) return;
    setNotifying(true);
    setError('');
    const result = await enqueueCustomerWithdrawalNotification(
      selected.id,
      selected.customer_id,
      selected.withdrawal_no,
      selected.created_by_email ?? null,
      notifyNote || null,
    );
    setNotifying(false);
    if (result.error) {
      setError(result.error.message ?? 'Notification failed');
      return;
    }
    setActionMsg(t('admin_notify_customer'));
    setNotifyOpen(false);
  }

  if (loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-admin-withdrawal-review-page">
        <LoadingState />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-admin-withdrawal-review-page">
      <PageHeader
        title={t('admin_withdrawal_review_title')}
        description={t('admin_withdrawal_review_description')}
      />
      <CustomerPortalLiveBanner />
      {actionMsg ? <div className="alert-success-panel" role="status">{actionMsg}</div> : null}
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}

      {/* List table */}
      <div className="table-card">
        <div className="table-card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>{t('admin_withdrawal_review_table_title')}</h3>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="form-label" style={{ margin: 0, flex: '1 1 200px', maxWidth: 280 }}>
              {'ค้นหา'}
              <input
                type="text"
                className="form-control"
                placeholder="ค้นหา (ทุกคอลัมน์)..."
                value={globalSearchText}
                onChange={(e) => setGlobalSearchText(e.target.value)}
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
            <label className="form-label" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}>
              {'วันที่แจ้งเบิก (ตั้งแต่)'}
              <input
                className="form-control"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </label>
            <label className="form-label" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}>
              {'วันที่แจ้งเบิก (ถึง)'}
              <input
                className="form-control"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </label>
            {(globalSearchText || filterCustomer || filterDateFrom || filterDateTo) ? (
              <button
                type="button"
                className="btn"
                onClick={() => { setGlobalSearchText(''); setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                style={{ alignSelf: 'flex-end', background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}
              >
                {'ล้างตัวกรอง'}
              </button>
            ) : null}
          </div>
        </div>
        <div className="responsive-table">
          <table className="data-table" data-testid="admin-withdrawal-review-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('withdrawal_no')} style={{ cursor: 'pointer' }}>{t('customer_col_request_no')} {getSortIndicator('withdrawal_no')}</th>
                <th onClick={() => requestSort('customer_id')} style={{ cursor: 'pointer' }}>ลูกค้า {getSortIndicator('customer_id')}</th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>{t('customer_col_status')} {getSortIndicator('status')}</th>
                <th>{t('customer_field_requested_dispatch_date')}</th>
                <th>{t('customer_field_delivery_type')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.length ? sortedData.map((row) => (
                <tr 
                  key={row.id}
                  onClick={() => openDetail(row.id)}
                  style={{ cursor: 'pointer', background: selectedId === row.id ? '#f0f9ff' : 'inherit' }}
                >
                  <td>{row.withdrawal_no}</td>
                  <td>{row.customer?.customer_name || row.customer?.name || row.customer_id}</td>
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getWithdrawalStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{formatDocumentDate(row.requested_dispatch_date, { dateOnly: true })}</td>
                  <td>{row.delivery_type ?? '-'}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      data-testid={`admin-withdrawal-review-select-${row.id}`}
                      type="button"
                      onClick={() => openDetail(row.id)}
                    >
                      {t('receiving_review_deposit_button')}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5}>{t('admin_withdrawal_review_empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail popup */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.withdrawal_no ?? t('admin_withdrawal_review_title')}
        size="xl"
      >
        {selected ? (
          <>
            {actionMsg ? <div className="alert-success-panel" role="status" style={{ marginBottom: 12 }}>{actionMsg}</div> : null}
            {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}

            {/* Header info */}
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div>
                <div className="form-label">{t('customer_col_status')}</div>
                <span className={`status-badge status-badge--${getCustomerRequestStatusClass(selected.status)}`}>
                  {getWithdrawalStatusLabel(selected.status, t)}
                </span>
              </div>
              <div>
                <div className="form-label">{t('customer_field_requested_dispatch_date')}</div>
                <div>{formatDocumentDate(selected.requested_dispatch_date, { dateOnly: true })}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_delivery_type')}</div>
                <div>{selected.delivery_type ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_pickup_contact')}</div>
                <div>{selected.pickup_contact ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_vehicle_registration')}</div>
                <div>{selected.vehicle_registration || '-'}</div>
              </div>
            </div>

            {/* Print action */}
            <div className="action-row" style={{ marginBottom: 16 }}>
              <ReportPrintActions
                disabled={false}
                renderReport={(language) => (
                  <CustomerWithdrawalRequestPrintDocument
                    branding={branding}
                    header={selected}
                    language={language}
                    lines={lines}
                  />
                )}
                title={selected.withdrawal_no}
              />
            </div>

            {/* Lines table with actual qty column and recount button */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px' }}>{t('document_lines')}</h4>
              <div className="responsive-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('catalog_col_customer_code')}</th>
                      <th>{t('catalog_col_product_name')}</th>
                      <th>{t('lot')}</th>
                      <th>กล่อง (หยิบจริง / แจ้งเบิก)</th>
                      <th>น้ำหนัก กก. (หยิบจริง / แจ้งเบิก)</th>
                      <th>หมายเหตุ (Admin)</th>
                      <th>{t('catalog_col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length ? lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.line_no}</td>
                        <td>{line.customer_product_code ?? '-'}</td>
                        <td>{line.product_name ?? '-'}</td>
                        <td>{line.lot_no ?? '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {line.picked_boxes != null ? (
                            <>
                              <span style={{ fontWeight: 700, color: Number(line.picked_boxes) !== Number(line.requested_boxes) ? 'var(--tgd-warning)' : 'var(--tgd-success)' }}>
                                {line.picked_boxes}
                              </span>
                              <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}> / {line.requested_boxes ?? '-'}</span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>- / {line.requested_boxes ?? '-'}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {line.picked_weight != null ? (
                            <>
                              <span style={{ fontWeight: 700, color: Number(line.picked_weight).toFixed(2) !== Number(line.requested_weight).toFixed(2) ? 'var(--tgd-warning)' : 'var(--tgd-success)' }}>
                                {Number(line.picked_weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>
                                {' / '}{line.requested_weight != null ? Number(line.requested_weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                              </span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>
                              {'- / '}{line.requested_weight != null ? Number(line.requested_weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </span>
                          )}
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: 12, padding: '2px 6px', height: 28 }}
                              placeholder="หมายเหตุ..."
                              value={lineAdminNotes[line.id] ?? line.admin_note ?? ''}
                              onChange={(e) => setLineAdminNotes((prev) => ({ ...prev, [line.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={savingAdminNote[line.id]}
                              style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '2px 8px', height: 28 }}
                              onClick={async () => {
                                setSavingAdminNote((prev) => ({ ...prev, [line.id]: true }));
                                const r = await updateWithdrawalLineAdminNote(line.id, lineAdminNotes[line.id] ?? '');
                                setSavingAdminNote((prev) => ({ ...prev, [line.id]: false }));
                                if (!r.error) {
                                  setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, admin_note: lineAdminNotes[line.id] } : l));
                                }
                              }}
                            >
                              {savingAdminNote[line.id] ? '…' : '💾'}
                            </button>
                          </div>
                        </td>
                        <td>
                          {!['COMPLETED', 'DISPATCHED', 'CANCELLED', 'REJECTED'].includes(selected?.status) ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              onClick={() => {
                                setRecountLine(line);
                                setRecountBoxes((line.picked_boxes ?? line.requested_boxes ?? '').toString());
                                setRecountWeight((line.picked_weight ?? line.requested_weight ?? '').toString());
                                setRecountQty((line.picked_qty ?? line.requested_qty ?? '').toString());
                                setError('');
                              }}
                            >
                              {t('admin_recount_button')}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8}>{t('customer_request_detail_lines_empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Admin comment */}
            <label className="form-field" style={{ marginBottom: 16 }}>
              <span>{t('admin_review_comment_label')}</span>
              <textarea className="form-control" sortedData={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>

            {/* Action buttons */}
            <div className="action-row">
              {canOpenWorkOrder ? (
                <button
                  className="btn btn-primary"
                  data-testid="btn-open-work-order"
                  disabled={submitting}
                  onClick={handleOpenWorkOrder}
                  type="button"
                >
                  {submitting ? '...' : t('admin_open_work_order')}
                </button>
              ) : null}
              {canSendToHandheld ? (
                <button
                  className="btn btn-primary"
                  data-testid="btn-send-to-handheld"
                  disabled={submitting}
                  onClick={handleSendToHandheld}
                  type="button"
                >
                  {submitting ? '...' : t('admin_send_to_handheld')}
                </button>
              ) : null}
              {canConfirmWithdrawal ? (
                <button
                  className="btn btn-primary"
                  data-testid="btn-confirm-withdrawal"
                  disabled={submitting}
                  onClick={handleConfirmWithdrawal}
                  type="button"
                >
                  {submitting ? '...' : t('admin_confirm_withdrawal')}
                </button>
              ) : null}
              {canReject ? (
                <button
                  className="btn btn-danger"
                  data-testid="btn-reject-withdrawal"
                  disabled={submitting}
                  onClick={() => setRejectOpen(true)}
                  type="button"
                >
                  {t('admin_reject_request')}
                </button>
              ) : null}
              {canCancel ? (
                <button
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => { setCancelComment(''); setCancelOpen(true); }}
                  type="button"
                >
                  ยกเลิกเอกสาร
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </Modal>

      {/* Cancel modal */}
      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="ยกเลิกเอกสาร"
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-danger" disabled={submitting} onClick={handleCancel} type="button">
              ยืนยันยกเลิก
            </button>
            <button className="btn btn-secondary" onClick={() => setCancelOpen(false)} type="button">
              {t('cancel')}
            </button>
          </div>
        )}
      >
        <p style={{ marginTop: 0 }}>เอกสารจะถูกยกเลิกและไม่สามารถนำกลับมาใช้ได้</p>
        <label className="form-field">
          <span>หมายเหตุ (ไม่บังคับ)</span>
          <textarea
            className="form-control"
            sortedData={3}
            value={cancelComment}
            onChange={(e) => setCancelComment(e.target.value)}
            placeholder="ระบุสาเหตุการยกเลิก..."
          />
        </label>
      </Modal>

      {/* Reject modal */}
      <Modal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t('admin_reject_request')}
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-danger" disabled={submitting} onClick={handleReject} type="button">
              {t('admin_reject_request')}
            </button>
            <button className="btn btn-secondary" onClick={() => setRejectOpen(false)} type="button">
              {t('cancel')}
            </button>
          </div>
        )}
      >
        <label className="form-field">
          <span>{t('admin_reject_reason_label')}</span>
          <textarea
            className="form-control"
            sortedData={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('admin_reject_reason_placeholder')}
          />
        </label>
      </Modal>

      {/* Notify customer after confirm */}
      <Modal
        isOpen={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        title={t('admin_notify_customer_title')}
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-primary" disabled={notifying} onClick={handleNotifyCustomer} type="button">
              {notifying ? '...' : t('admin_notify_customer')}
            </button>
            <button className="btn btn-secondary" onClick={() => setNotifyOpen(false)} type="button">
              {t('admin_skip_notify')}
            </button>
          </div>
        )}
      >
        <p style={{ marginTop: 0 }}>{t('admin_notify_customer_description')}</p>
        <label className="form-field">
          <span>{t('admin_notify_customer_note_label')}</span>
          <textarea
            className="form-control"
            sortedData={3}
            value={notifyNote}
            onChange={(e) => setNotifyNote(e.target.value)}
            placeholder={t('admin_notify_customer_note_placeholder')}
          />
        </label>
      </Modal>

      {/* Recount modal */}
      <Modal
        isOpen={!!recountLine}
        onClose={() => setRecountLine(null)}
        title={t('admin_recount_title')}
        size="sm"
        footer={(
          <div className="action-row">
            <button
              className="btn btn-primary"
              type="button"
              disabled={recounting}
              onClick={handleSaveRecount}
            >
              {recounting ? '...' : t('save')}
            </button>
            <button className="btn btn-secondary" onClick={() => setRecountLine(null)} type="button">
              {t('cancel')}
            </button>
          </div>
        )}
      >
        {recountLine ? (
          <>
            <p style={{ marginTop: 0 }}>
              <strong>{recountLine.product_name ?? recountLine.customer_product_code}</strong>
            </p>
            {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 8 }}>{error}</div> : null}
            <div className="form-grid">
              <label className="form-field">
                <span>กล่องที่หยิบจริง</span>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  step={1}
                  value={recountBoxes}
                  onChange={(e) => setRecountBoxes(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>น้ำหนักที่หยิบจริง (กก.)</span>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  step={0.001}
                  value={recountWeight}
                  onChange={(e) => setRecountWeight(e.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

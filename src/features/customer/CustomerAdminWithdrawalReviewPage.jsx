import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useState } from 'react';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerWithdrawalRequestPrintDocument } from '../../components/customer/CustomerWithdrawalRequestPrintDocument.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getWithdrawalStatusLabel } from '../../utils/customerWithdrawalStatusLabels.js';
import {
  listCustomerWithdrawalRequests,
  listCustomerWithdrawalRequestLines,
  reviewCustomerWithdrawalRequest,
  cancelCustomerWithdrawalRequest,
  enqueueCustomerWithdrawalNotification,
} from '../../services/customerWithdrawalRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

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
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [globalSearchText, setGlobalSearchText] = useState('');

  const filteredRows = rows.filter((row) => {
    if (!globalSearchText) return true;
    const lower = globalSearchText.toLowerCase();
    const custName = row.customer?.customer_name || row.customer?.name || row.customer_id;
    return (
      (row.withdrawal_no || '').toLowerCase().includes(lower) ||
      (row.status || '').toLowerCase().includes(lower) ||
      (row.delivery_type || '').toLowerCase().includes(lower) ||
      (row.pickup_contact || '').toLowerCase().includes(lower) ||
      (row.destination || '').toLowerCase().includes(lower) ||
      (custName || '').toLowerCase().includes(lower)
    );
  });

  const { sortedData, requestSort, getSortIndicator } = useTableSort(filteredRows);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listCustomerWithdrawalRequests({ statusIn: REVIEW_STATUSES }).then((result) => {
      if (!active) return;
      const data = result.data ?? [];
      setRows(data);
      setSelectedId(data[0]?.id ?? '');
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
      setLines(result.data ?? []);
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

    if (selected.status === 'SUBMITTED_BY_CUSTOMER') {
      const reviewResult = await reviewCustomerWithdrawalRequest(selectedId, 'REVIEWING', comment);
      if (reviewResult.error) {
        setError(reviewResult.error.message ?? 'Review step failed');
        setSubmitting(false);
        return;
      }
    }

    const acceptResult = await reviewCustomerWithdrawalRequest(selectedId, 'ACCEPT', comment);
    if (acceptResult.error) {
      setError(acceptResult.error.message ?? 'Open work order failed');
      setSubmitting(false);
      return;
    }

    // Auto send to handheld (WAREHOUSE_PICKING) immediately after accepting
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
        <div className="table-card-header" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('admin_withdrawal_review_table_title')}</h3>
          <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="ค้นหา (ทุกคอลัมน์)..."
              value={globalSearchText}
              onChange={(e) => setGlobalSearchText(e.target.value)}
            />
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
                <tr key={row.id}>
                  <td>{row.withdrawal_no}</td>
                  <td>{row.customer?.customer_name || row.customer?.name || row.customer_id}</td>
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getWithdrawalStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{row.requested_dispatch_date ?? '-'}</td>
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
        size="lg"
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
                <div>{selected.requested_dispatch_date ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_delivery_type')}</div>
                <div>{selected.delivery_type ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_pickup_contact')}</div>
                <div>{selected.pickup_contact ?? '-'}</div>
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
                      <th>น้ำหนักที่ขอ (กก.)</th>
                      <th>กล่องที่ขอ</th>
                      <th>จำนวนที่ขอ</th>
                      <th>{t('admin_picked_qty')}</th>
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
                          {line.requested_weight != null
                            ? Number(line.requested_weight).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>{line.requested_boxes ?? '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {line.requested_qty != null ? `${line.requested_qty} ${line.uom ?? ''}`.trim() : '-'}
                        </td>
                        <td>
                          <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>
                            {t('pending')}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={() => {
                              setRecountLine(line);
                              setRecountQty(line.requested_qty?.toString() ?? '');
                              setRecountBoxes(line.requested_boxes?.toString() ?? '');
                            }}
                          >
                            {t('admin_recount_button')}
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={9}>{t('customer_request_detail_lines_empty')}</td></tr>
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
              onClick={() => {
                setActionMsg(t('admin_recount_saved'));
                setRecountLine(null);
              }}
            >
              {t('save')}
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
            <div className="form-grid">
              <label className="form-field">
                <span>{t('admin_received_boxes')}</span>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  value={recountBoxes}
                  onChange={(e) => setRecountBoxes(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>{t('admin_picked_qty')}</span>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  value={recountQty}
                  onChange={(e) => setRecountQty(e.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

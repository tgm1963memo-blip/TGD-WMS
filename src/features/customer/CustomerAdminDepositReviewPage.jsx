import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerDepositRequestLinesDisplay } from '../../components/customer/CustomerDepositRequestLinesDisplay.jsx';
import { CustomerDepositRequestPrintDocument } from '../../components/customer/CustomerDepositRequestPrintDocument.jsx';
import { CustomerDepositStaffWorkOrderPrint } from '../../components/customer/CustomerDepositStaffWorkOrderPrint.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import {
  listCustomerDepositRequests,
  listCustomerDepositRequestLines,
  reviewCustomerDepositRequest,
  cancelCustomerDepositRequest,
  recordDepositLineActualReceipt,
  enqueueCustomerDepositNotification,
} from '../../services/customerDepositRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const REVIEW_STATUSES = [
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_RECEIVING',
  'PALLETIZING',
  'COUNT_VARIANCE_REVIEW',
  'ADMIN_RECOUNT_REQUESTED',
  'RECEIVED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
  'CANCELLED',
];

export function CustomerAdminDepositReviewPage() {
  const t = useTranslation();
  const { requestId: routeRequestId } = useParams();
  const [rows, setRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedId, setSelectedId] = useState(routeRequestId ?? '');
  const [detailOpen, setDetailOpen] = useState(!!routeRequestId);
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

  useEffect(() => {
    let active = true;
    setLoading(true);

    listCustomerDepositRequests({ statusIn: REVIEW_STATUSES }).then((result) => {
      if (!active) return;
      const data = result.data ?? [];
      setRows(data);
      setLoading(false);
      setError(result.error?.message ?? '');
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (routeRequestId) setSelectedId(routeRequestId);
  }, [routeRequestId]);

  useEffect(() => {
    if (!selectedId && rows.length) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  useEffect(() => {
    let active = true;
    if (!selectedId) { setLines([]); return undefined; }

    listCustomerDepositRequestLines(selectedId).then((result) => {
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

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const branding = getDocumentBrandingConfig();

  const canOpenWorkOrder = selected && ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(selected.status);
  const allLinesHaveActualQty = lines.length > 0 && lines.every((l) => l.actual_boxes != null || l.actual_weight != null);
  const canConfirmReceiving = selected &&
    ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(selected.status) &&
    allLinesHaveActualQty;
  const confirmBlockedReason = selected &&
    ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(selected.status) &&
    !allLinesHaveActualQty
    ? 'กรุณาบันทึกจำนวนรับจริงทุกรายการก่อนยืนยัน'
    : '';
  const canReject = selected && !['REJECTED', 'COMPLETED', 'RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CANCELLED'].includes(selected.status);
  const canCancel = selected && !['COMPLETED', 'RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CANCELLED', 'REJECTED'].includes(selected.status);

  async function handleOpenWorkOrder() {
    if (!selectedId || !selected) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    if (selected.status === 'SUBMITTED_BY_CUSTOMER') {
      const reviewResult = await reviewCustomerDepositRequest(selectedId, 'REVIEWING', comment);
      if (reviewResult.error) {
        setError(reviewResult.error.message ?? 'Review step failed');
        setSubmitting(false);
        return;
      }
    }

    const acceptResult = await reviewCustomerDepositRequest(selectedId, 'ACCEPT', comment);
    setSubmitting(false);
    if (acceptResult.error) {
      setError(acceptResult.error.message ?? 'Open work order failed');
      return;
    }
    const newStatus = acceptResult.data?.status ?? 'WAREHOUSE_RECEIVING';
    setActionMsg(t('admin_work_order_opened'));
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
  }

  async function handleConfirmReceiving() {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    const result = await reviewCustomerDepositRequest(selectedId, 'CONFIRM_RECEIPT', comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Confirm receiving failed');
      return;
    }
    const newStatus = result.data?.status ?? 'COMPLETED';
    setActionMsg(t('admin_receiving_confirmed'));
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
    setNotifyNote('');
    setNotifyOpen(true);
  }

  async function handleReject() {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    const result = await reviewCustomerDepositRequest(selectedId, 'REJECT', rejectReason || comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Reject failed');
      return;
    }
    const newStatus = result.data?.status ?? 'REJECTED';
    setActionMsg(getDepositStatusLabel(newStatus, t) || newStatus);
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
    setRejectOpen(false);
    setRejectReason('');
  }

  async function handleCancel() {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    const result = await cancelCustomerDepositRequest(selectedId, cancelComment || null);
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
    const result = await enqueueCustomerDepositNotification(
      selected.id,
      selected.customer_id,
      selected.request_no,
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
      <section className="page-shell customer-portal-page" data-testid="customer-admin-deposit-review-page">
        <LoadingState />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-admin-deposit-review-page">
      <PageHeader
        title={t('admin_deposit_review_title')}
        description={t('admin_deposit_review_description')}
        actions={(
          <Link className="btn btn-secondary" to="/handheld">
            {t('handheld_receiving_go')}
          </Link>
        )}
      />
      <CustomerPortalLiveBanner />
      {actionMsg ? <div className="alert-success-panel" role="status">{actionMsg}</div> : null}
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}

      {/* List table — hidden when accessed via direct requestId link (prevents duplicate list) */}
      <div className="table-card" style={{ display: routeRequestId ? 'none' : undefined }}>
        <div className="table-card-header">
          <h3>{t('admin_deposit_review_table_title')}</h3>
        </div>
        <div className="responsive-table">
          <table className="data-table" data-testid="admin-deposit-review-table">
            <thead>
              <tr>
                <th>{t('customer_col_request_no')}</th>
                <th>{t('customer_col_status')}</th>
                <th>{t('customer_field_expected_arrival_date')}</th>
                <th>{t('customer_field_contact_name')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.request_no}</td>
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getDepositStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{row.expected_arrival_date ?? '-'}</td>
                  <td>{row.contact_name ?? '-'}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      data-testid={`admin-deposit-review-select-${row.id}`}
                      type="button"
                      onClick={() => openDetail(row.id)}
                    >
                      {t('receiving_review_deposit_button')}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5}>{t('admin_deposit_review_empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail popup */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.request_no ?? t('admin_deposit_review_title')}
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
                  {getDepositStatusLabel(selected.status, t)}
                </span>
              </div>
              <div>
                <div className="form-label">{t('customer_field_expected_arrival_date')}</div>
                <div>{selected.expected_arrival_date ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_contact_name')}</div>
                <div>{selected.contact_name ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_vehicle_registration')}</div>
                <div>{selected.vehicle_registration ?? '-'}</div>
              </div>
            </div>

            {/* Print actions — single set */}
            <div className="action-row" style={{ marginBottom: 16 }}>
              <ReportPrintActions
                disabled={false}
                renderReport={(language) => (
                  <CustomerDepositStaffWorkOrderPrint
                    branding={branding}
                    header={selected}
                    language={language}
                    lines={lines}
                  />
                )}
                title={`${selected.request_no} — ${t('admin_staff_work_order')}`}
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
                      <th>{t('customer_col_weight_per_box')}</th>
                      <th>กล่อง (รับจริง / แจ้งฝาก)</th>
                      <th>น้ำหนัก กก. (รับจริง / แจ้งฝาก)</th>
                      <th>{t('catalog_col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length ? lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.line_no}</td>
                        <td>{line.customer_product_code ?? '-'}</td>
                        <td>{line.product_name ?? '-'}</td>
                        <td>{line.weight_per_box ?? '-'}</td>
                        <td>
                          {line.actual_boxes != null ? (
                            <span style={{ fontWeight: 700, color: 'var(--tgd-success)' }}>
                              {line.actual_boxes}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--tgd-danger)', fontSize: 12, fontWeight: 600 }}>⚠</span>
                          )}
                          <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}> / {line.expected_boxes ?? '-'}</span>
                        </td>
                        <td>
                          {line.actual_weight != null ? (
                            <span style={{ fontWeight: 700, color: 'var(--tgd-success)' }}>
                              {line.actual_weight}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>—</span>
                          )}
                          <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}> / {line.expected_weight ?? '-'}</span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={() => {
                              setRecountLine(line);
                              setRecountBoxes(line.actual_boxes?.toString() ?? line.expected_boxes?.toString() ?? '');
                              setRecountQty(line.actual_weight?.toString() ?? line.expected_weight?.toString() ?? '');
                            }}
                          >
                            {t('admin_recount_button')}
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7}>{t('customer_request_detail_lines_empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Admin comment */}
            <label className="form-field" style={{ marginBottom: 16 }}>
              <span>{t('admin_review_comment_label')}</span>
              <textarea className="form-control" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>

            {/* Warning when confirm is blocked */}
            {confirmBlockedReason ? (
              <div className="banner banner-warning" role="status" style={{ marginBottom: 12 }}>
                ⚠️ {confirmBlockedReason}
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="action-row">
              {canOpenWorkOrder ? (
                <button
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={handleOpenWorkOrder}
                  type="button"
                >
                  {t('admin_open_work_order')}
                </button>
              ) : null}
              {selected && ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(selected.status) ? (
                <button
                  className="btn btn-primary"
                  disabled={submitting || !canConfirmReceiving}
                  onClick={handleConfirmReceiving}
                  title={confirmBlockedReason}
                  type="button"
                >
                  {t('admin_confirm_receiving')}
                </button>
              ) : null}
              {canReject ? (
                <button
                  className="btn btn-danger"
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

            {/* Persistent email notification section */}
            {selected && ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'].includes(selected.status) ? (
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--tgd-surface-alt, #f8fafc)', borderRadius: 8, border: '1px solid var(--tgd-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>แจ้งลูกค้าทางอีเมล</div>
                    {selected.status === 'CUSTOMER_NOTIFIED' ? (
                      <span style={{ fontSize: 12, color: 'var(--tgd-success)', fontWeight: 600 }}>✓ ส่งอีเมลแจ้งลูกค้าแล้ว</span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--tgd-warning, #d97706)', fontWeight: 600 }}>⚠ ยังไม่ได้ส่งอีเมลแจ้งลูกค้า</span>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={notifying}
                    onClick={() => { setNotifyNote(''); setNotifyOpen(true); }}
                    type="button"
                  >
                    {selected.status === 'CUSTOMER_NOTIFIED' ? 'ส่งอีเมลซ้ำ' : 'ส่งอีเมลแจ้งลูกค้า'}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>

      {/* Reject confirmation modal */}
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
            rows={3}
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
            rows={3}
            value={notifyNote}
            onChange={(e) => setNotifyNote(e.target.value)}
            placeholder={t('admin_notify_customer_note_placeholder')}
          />
        </label>
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
            rows={3}
            value={cancelComment}
            onChange={(e) => setCancelComment(e.target.value)}
            placeholder="ระบุสาเหตุการยกเลิก..."
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
              disabled={submitting}
              type="button"
              onClick={async () => {
                if (!recountLine) return;
                setSubmitting(true);
                setError('');
                const result = await recordDepositLineActualReceipt(recountLine.id, {
                  actualBoxes: recountBoxes,
                  actualWeight: recountQty,
                  note: null,
                });
                setSubmitting(false);
                if (result.error) {
                  setError(result.error.message ?? 'Save failed');
                  return;
                }
                setLines((prev) => prev.map((l) => l.id === recountLine.id
                  ? { ...l, actual_boxes: Number(recountBoxes) || null, actual_weight: Number(recountQty) || null }
                  : l));
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
                <span>{t('admin_received_qty')}</span>
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

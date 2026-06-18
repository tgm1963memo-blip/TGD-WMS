import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { LoadingState } from '../ui/LoadingState.jsx';
import { ReportPrintActions } from '../reports/ReportPrintActions.jsx';
import { CustomerDepositStaffWorkOrderPrint } from './CustomerDepositStaffWorkOrderPrint.jsx';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import {
  getCustomerDepositRequest,
  listCustomerDepositRequestLines,
  reviewCustomerDepositRequest,
  recordDepositLineActualReceipt,
  enqueueCustomerDepositNotification,
} from '../../services/customerDepositRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerDepositDetailModal({ requestId, isOpen, onClose, onStatusChange }) {
  const t = useTranslation();
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyNote, setNotifyNote] = useState('');
  const [recountLine, setRecountLine] = useState(null);
  const [recountBoxes, setRecountBoxes] = useState('');
  const [recountQty, setRecountQty] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    if (!requestId || !isOpen) return;
    let active = true;
    setLoading(true);
    setActionMsg('');
    setError('');
    setComment('');

    Promise.all([
      getCustomerDepositRequest(requestId),
      listCustomerDepositRequestLines(requestId),
    ]).then(([hRes, lRes]) => {
      if (!active) return;
      setHeader(hRes.data ?? null);
      setLines(lRes.data ?? []);
      setLoading(false);
    });

    return () => { active = false; };
  }, [requestId, isOpen]);

  const branding = getDocumentBrandingConfig();

  const canOpenWorkOrder = header && ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(header.status);
  const canConfirmReceiving = header &&
    ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(header.status) &&
    lines.length > 0 &&
    lines.every((l) => l.actual_boxes != null || l.actual_weight != null);
  const confirmBlockedReason = header &&
    ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(header.status) &&
    lines.length > 0 &&
    !lines.every((l) => l.actual_boxes != null || l.actual_weight != null)
    ? 'กรุณาบันทึกจำนวนรับจริงทุกรายการก่อนยืนยัน'
    : '';
  const canReject = header && !['REJECTED', 'COMPLETED', 'RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CANCELLED'].includes(header.status);

  function updateHeaderStatus(newStatus) {
    setHeader((prev) => prev ? { ...prev, status: newStatus } : prev);
    onStatusChange?.(requestId, newStatus);
  }

  async function handleOpenWorkOrder() {
    if (!requestId || !header) return;
    setSubmitting(true); setError(''); setActionMsg('');
    if (header.status === 'SUBMITTED_BY_CUSTOMER') {
      const r = await reviewCustomerDepositRequest(requestId, 'REVIEWING', comment);
      if (r.error) { setError(r.error.message ?? 'Review step failed'); setSubmitting(false); return; }
    }
    const r = await reviewCustomerDepositRequest(requestId, 'ACCEPT', comment);
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'Open work order failed'); return; }
    const newStatus = r.data?.status ?? 'WAREHOUSE_RECEIVING';
    setActionMsg(t('admin_work_order_opened'));
    updateHeaderStatus(newStatus);
  }

  async function handleConfirmReceiving() {
    if (!requestId) return;
    setSubmitting(true); setError(''); setActionMsg('');
    const r = await reviewCustomerDepositRequest(requestId, 'CONFIRM_RECEIPT', comment);
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'Confirm receiving failed'); return; }
    const newStatus = r.data?.status ?? 'RECEIVED_CONFIRMED';
    setActionMsg(t('admin_receiving_confirmed'));
    updateHeaderStatus(newStatus);
    setNotifyNote('');
    setNotifyOpen(true);
  }

  async function handleReject() {
    if (!requestId) return;
    setSubmitting(true); setError('');
    const r = await reviewCustomerDepositRequest(requestId, 'REJECT', rejectReason || comment);
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'Reject failed'); return; }
    const newStatus = r.data?.status ?? 'REJECTED';
    setActionMsg(getDepositStatusLabel(newStatus, t) || newStatus);
    updateHeaderStatus(newStatus);
    setRejectOpen(false);
    setRejectReason('');
  }

  async function handleNotifyCustomer() {
    if (!header) return;
    setNotifying(true); setError('');
    const r = await enqueueCustomerDepositNotification(
      header.id, header.customer_id, header.request_no, header.created_by_email ?? null, notifyNote || null,
    );
    setNotifying(false);
    if (r.error) { setError(r.error.message ?? 'Notification failed'); return; }
    setActionMsg(t('admin_notify_customer'));
    setNotifyOpen(false);
  }

  async function handleSaveRecount() {
    if (!recountLine) return;
    setSubmitting(true); setError('');
    const r = await recordDepositLineActualReceipt(recountLine.id, {
      actualBoxes: recountBoxes,
      actualWeight: recountQty,
      note: null,
    });
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'Save failed'); return; }
    setLines((prev) => prev.map((l) =>
      l.id === recountLine.id
        ? { ...l, actual_boxes: Number(recountBoxes) || null, actual_weight: Number(recountQty) || null }
        : l,
    ));
    setActionMsg(t('admin_recount_saved'));
    setRecountLine(null);
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={header?.request_no ?? t('admin_deposit_review_title')}
        size="lg"
      >
        {loading ? <LoadingState /> : !header ? (
          <p style={{ color: 'var(--tgd-muted-text)' }}>ไม่พบข้อมูลเอกสาร</p>
        ) : (
          <>
            {actionMsg ? <div className="alert-success-panel" role="status" style={{ marginBottom: 12 }}>{actionMsg}</div> : null}
            {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}

            {/* Header info */}
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div>
                <div className="form-label">{t('customer_col_status')}</div>
                <span className={`status-badge status-badge--${getCustomerRequestStatusClass(header.status)}`}>
                  {getDepositStatusLabel(header.status, t)}
                </span>
              </div>
              <div>
                <div className="form-label">{t('customer_field_expected_arrival_date')}</div>
                <div>{header.expected_arrival_date ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_contact_name')}</div>
                <div>{header.contact_name ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_vehicle_registration')}</div>
                <div>{header.vehicle_registration ?? '-'}</div>
              </div>
            </div>

            {/* Print actions */}
            <div className="action-row" style={{ marginBottom: 16 }}>
              <ReportPrintActions
                disabled={false}
                renderReport={(language) => (
                  <CustomerDepositStaffWorkOrderPrint
                    branding={branding}
                    header={header}
                    language={language}
                    lines={lines}
                  />
                )}
                title={`${header.request_no} — ${t('admin_staff_work_order')}`}
              />
            </div>

            {/* Lines table */}
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
                      <th>{t('customer_col_total_deposit_weight')}</th>
                      <th>{t('customer_col_box_count')}</th>
                      <th>{t('admin_received_qty')}</th>
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
                        <td>{line.expected_weight ?? '-'}</td>
                        <td>{line.expected_boxes ?? '-'}</td>
                        <td>
                          {line.actual_boxes != null ? (
                            <span style={{ fontWeight: 600, color: 'var(--tgd-success)' }}>
                              {line.actual_boxes} กล่อง
                              {line.actual_weight != null ? ` · ${line.actual_weight} กก.` : ''}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--tgd-danger)', fontSize: 12 }}>ยังไม่ได้บันทึก</span>
                          )}
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
                      <tr><td colSpan={8}>{t('customer_request_detail_lines_empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comment */}
            <label className="form-field" style={{ marginBottom: 16 }}>
              <span>{t('admin_review_comment_label')}</span>
              <textarea className="form-control" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>

            {/* Confirm-block warning */}
            {confirmBlockedReason ? (
              <div className="banner banner-warning" role="status" style={{ marginBottom: 12 }}>
                ⚠️ {confirmBlockedReason}
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="action-row">
              {canOpenWorkOrder ? (
                <button className="btn btn-primary" disabled={submitting} onClick={handleOpenWorkOrder} type="button">
                  {t('admin_open_work_order')}
                </button>
              ) : null}
              {header && ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(header.status) ? (
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
                <button className="btn btn-danger" disabled={submitting} onClick={() => setRejectOpen(true)} type="button">
                  {t('admin_reject_request')}
                </button>
              ) : null}
            </div>
          </>
        )}
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
            <button className="btn btn-secondary" onClick={() => setRejectOpen(false)} type="button">{t('cancel')}</button>
          </div>
        )}
      >
        <label className="form-field">
          <span>{t('admin_reject_reason_label')}</span>
          <textarea className="form-control" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('admin_reject_reason_placeholder')} />
        </label>
      </Modal>

      {/* Notify customer modal */}
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
          <textarea className="form-control" rows={3} value={notifyNote} onChange={(e) => setNotifyNote(e.target.value)} placeholder={t('admin_notify_customer_note_placeholder')} />
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
            <button className="btn btn-primary" disabled={submitting} type="button" onClick={handleSaveRecount}>
              {t('save')}
            </button>
            <button className="btn btn-secondary" onClick={() => setRecountLine(null)} type="button">{t('cancel')}</button>
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
                <input className="form-control" type="number" min={0} value={recountBoxes} onChange={(e) => setRecountBoxes(e.target.value)} />
              </label>
              <label className="form-field">
                <span>{t('admin_received_qty')}</span>
                <input className="form-control" type="number" min={0} value={recountQty} onChange={(e) => setRecountQty(e.target.value)} />
              </label>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}

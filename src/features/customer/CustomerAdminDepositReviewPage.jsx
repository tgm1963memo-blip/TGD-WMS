import { useTableSort } from '../../hooks/useTableSort.js';
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
  enqueueDepositRecountNotification,
} from '../../services/customerDepositRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { useUserRole } from '../../features/auth/UserRoleProvider.jsx';
import { hasRoleFunctionWriteAccess } from '../../security/roleFunctionPermissions.js';
import { getTemperatureTypeLabel } from '../../utils/temperatureTypeLabels.js';
import { printStickers, StickerRotationControl } from '../../utils/stickerPrint.jsx';

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
  const { role: userRole } = useUserRole();
  const canWrite = hasRoleFunctionWriteAccess(userRole, 'receiving');
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
  const [recountNote, setRecountNote] = useState('');
  const [recountRequestOpen, setRecountRequestOpen] = useState(false);
  const [recountRequestComment, setRecountRequestComment] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [globalSearchText, setGlobalSearchText] = useState('');
  const [selectedLineIds, setSelectedLineIds] = useState(() => new Set());

  const filteredRows = rows.filter((row) => {
    if (!globalSearchText) return true;
    const lower = globalSearchText.toLowerCase();
    const custName = row.customer?.customer_name || row.customer?.name || row.customer_id;
    return (
      (row.request_no || '').toLowerCase().includes(lower) ||
      (row.status || '').toLowerCase().includes(lower) ||
      (row.vehicle_registration || '').toLowerCase().includes(lower) ||
      (row.contact_name || '').toLowerCase().includes(lower) ||
      (row.contact_phone || '').toLowerCase().includes(lower) ||
      (custName || '').toLowerCase().includes(lower)
    );
  });

  const { sortedData, requestSort, getSortIndicator } = useTableSort(filteredRows);

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
    if (!selectedId && sortedData.length) setSelectedId(sortedData[0].id);
  }, [sortedData, selectedId]);

  useEffect(() => {
    let active = true;
    setSelectedLineIds(new Set());
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

  const selected = sortedData.find((row) => row.id === selectedId) ?? null;
  const branding = getDocumentBrandingConfig();

  const canOpenWorkOrder = canWrite && selected && ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(selected.status);
  const canRequestRecount = canWrite && selected && ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING'].includes(selected.status);
  const allLinesHaveActualQty = lines.length > 0 && lines.every((l) => l.actual_boxes != null && l.actual_weight != null);
  const canConfirmReceiving = canWrite && selected &&
    ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(selected.status) &&
    allLinesHaveActualQty;
  const confirmBlockedReason = canWrite && selected &&
    ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(selected.status) &&
    !allLinesHaveActualQty
    ? 'กรุณาบันทึกจำนวนรับจริงทุกรายการก่อนยืนยัน'
    : '';
  const canReject = canWrite && selected && !['REJECTED', 'COMPLETED', 'RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CANCELLED'].includes(selected.status);
  const canCancel = canWrite && selected && !['COMPLETED', 'RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CANCELLED', 'REJECTED'].includes(selected.status);

  async function handleOpenWorkOrder() {
    if (!selectedId || !selected) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    // Step 1: REVIEWING — only if React state thinks it's still SUBMITTED_BY_CUSTOMER.
    // If DB has already moved to ADMIN_REVIEWING (stale React state), the call fails with
    // "ADMIN_REVIEWING" in the error message — we ignore that and continue to ACCEPT.
    if (selected.status === 'SUBMITTED_BY_CUSTOMER') {
      const reviewResult = await reviewCustomerDepositRequest(selectedId, 'REVIEWING', comment);
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

  async function handleRequestRecount() {
    if (!selectedId || !selected) return;
    setSubmitting(true);
    setError('');
    setActionMsg('');

    const result = await reviewCustomerDepositRequest(selectedId, 'COUNT_VARIANCE', comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Request recount failed');
      return;
    }
    const newStatus = result.data?.status ?? 'COUNT_VARIANCE_REVIEW';
    setActionMsg('เปิดใบงานตรวจนับใหม่แล้ว');
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

  async function handleSendRecountNotification() {
    if (!selected) return;
    setNotifying(true);
    setError('');
    const result = await enqueueDepositRecountNotification(
      selected.id,
      selected.customer_id,
      selected.request_no,
      selected.created_by_email ?? null,
    );
    setNotifying(false);
    if (result.error) {
      setError(result.error.message ?? 'ส่งแจ้งเตือนไม่สำเร็จ');
      return;
    }
    setActionMsg('ส่งคำขอตรวจนับใหม่ไปยังหัวหน้า Admin แล้ว');
    setRecountRequestOpen(false);
    setRecountRequestComment('');
  }

  function toggleLineSelected(lineId) {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }

  function toggleSelectAllLines(candidateLines) {
    setSelectedLineIds((prev) => {
      const selectableIds = candidateLines.map((l) => l.id);
      const allSelected = selectableIds.length > 0 && selectableIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(selectableIds);
    });
  }

  function handlePrintSelectedStickers() {
    const depositDate = selected?.last_action_at ?? selected?.expected_arrival_date ?? null;
    const items = lines
      .filter((l) => selectedLineIds.has(l.id))
      .map((l) => {
        const quantityParts = [];
        if (l.actual_boxes != null) quantityParts.push(`${l.actual_boxes} กล่อง`);
        if (l.actual_weight != null) quantityParts.push(`${Number(l.actual_weight).toLocaleString('th-TH')} กก.`);
        return {
          depositDate,
          productName: l.product_name ?? l.customer_product_code ?? '-',
          quantityLabel: quantityParts.join(' / ') || '-',
          locationCode: l.location?.location_code ?? '-',
          trackingCode: l.tracking_code ?? '',
        };
      });
    if (!items.length) return;
    printStickers(items);
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
        <div className="table-card-header" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('admin_deposit_review_table_title')}</h3>
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
          <table className="data-table" data-testid="admin-deposit-review-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('request_no')} style={{ cursor: 'pointer' }}>{t('customer_col_request_no')} {getSortIndicator('request_no')}</th>
                <th onClick={() => requestSort('customer_id')} style={{ cursor: 'pointer' }}>ลูกค้า {getSortIndicator('customer_id')}</th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>{t('customer_col_status')} {getSortIndicator('status')}</th>
                <th onClick={() => requestSort('expected_arrival_date')} style={{ cursor: 'pointer' }}>{t('customer_field_expected_arrival_date')} {getSortIndicator('expected_arrival_date')}</th>
                <th>{t('customer_field_contact_name')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.length ? sortedData.map((row) => (
                <tr key={row.id}>
                  <td>{row.request_no}</td>
                  <td>{row.customer?.customer_name || row.customer?.name || row.customer_id}</td>
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getDepositStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{formatDocumentDate(row.expected_arrival_date, { dateOnly: true })}</td>
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
        footer={selected ? (
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
            {canRequestRecount ? (
              <button
                className="btn btn-warning"
                disabled={submitting}
                onClick={handleRequestRecount}
                type="button"
              >
                ตรวจนับใหม่ หากไม่ตรง
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
        ) : null}
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
                <div>{formatDocumentDate(selected.expected_arrival_date, { dateOnly: true })}</div>
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
                orientation="landscape"
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>{t('document_lines')}</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <StickerRotationControl />
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    disabled={selectedLineIds.size === 0}
                    onClick={handlePrintSelectedStickers}
                  >
                    🖨️ พิมพ์สติกเกอร์ที่เลือก{selectedLineIds.size > 0 ? ` (${selectedLineIds.size})` : ''}
                  </button>
                </div>
              </div>
              <div className="responsive-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          checked={lines.filter((l) => l.tracking_code).length > 0
                            && lines.filter((l) => l.tracking_code).every((l) => selectedLineIds.has(l.id))}
                          onChange={() => toggleSelectAllLines(lines.filter((l) => l.tracking_code))}
                          title="เลือกทั้งหมด (เฉพาะรายการที่มีรหัสติดตาม)"
                        />
                      </th>
                      <th>#</th>
                      <th>{t('catalog_col_customer_code')}</th>
                      <th>{t('catalog_col_product_name')}</th>
                      <th>{t('customer_col_weight_per_box')}</th>
                      <th>การจัดเก็บ</th>
                      <th>กล่อง (รับจริง / แจ้งฝาก)</th>
                      <th>น้ำหนัก กก. (รับจริง / แจ้งฝาก)</th>
                      <th>หมายเหตุ (Admin)</th>
                      <th>{t('catalog_col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length ? lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedLineIds.has(line.id)}
                            disabled={!line.tracking_code}
                            title={!line.tracking_code ? 'ไม่มีรหัสติดตาม พิมพ์สติกเกอร์ไม่ได้' : undefined}
                            onChange={() => toggleLineSelected(line.id)}
                          />
                        </td>
                        <td>{line.line_no}</td>
                        <td>{line.customer_product_code ?? '-'}</td>
                        <td>{line.product_name ?? '-'}</td>
                        <td>{line.weight_per_box ?? '-'}</td>
                        <td>{getTemperatureTypeLabel(line.temperature_type)}</td>
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
                          {line.actual_note ? (
                            <span style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>{line.actual_note}</span>
                          ) : (
                            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          {!canWrite ? (
                            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>—</span>
                          ) : !['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(selected?.status) ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              onClick={() => {
                                setRecountLine(line);
                                setRecountBoxes(line.actual_boxes?.toString() ?? line.expected_boxes?.toString() ?? '');
                                setRecountQty(line.actual_weight?.toString() ?? line.expected_weight?.toString() ?? '');
                                setRecountNote(line.actual_note ?? '');
                              }}
                            >
                              {t('admin_recount_button')}
                            </button>
                          ) : ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'].includes(selected?.status) ? (
                            <button
                              className="btn btn-warning btn-sm"
                              type="button"
                              onClick={() => { setRecountRequestComment(''); setRecountRequestOpen(true); }}
                            >
                              ขอนับใหม่
                            </button>
                          ) : (
                            <span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={10}>{t('customer_request_detail_lines_empty')}</td></tr>
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

            {/* Warning when confirm is blocked */}
            {confirmBlockedReason ? (
              <div className="banner banner-warning" role="status" style={{ marginBottom: 12 }}>
                ⚠️ {confirmBlockedReason}
              </div>
            ) : null}

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

      {/* Recount request notification modal (for confirmed deposits) */}
      <Modal
        isOpen={recountRequestOpen}
        onClose={() => setRecountRequestOpen(false)}
        title="ขอตรวจนับสินค้าใหม่"
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-warning" disabled={notifying} onClick={handleSendRecountNotification} type="button">
              {notifying ? '...' : 'ส่งคำขอไปยัง Admin'}
            </button>
            <button className="btn btn-secondary" onClick={() => setRecountRequestOpen(false)} type="button">
              {t('cancel')}
            </button>
          </div>
        )}
      >
        <div className="banner banner-warning" style={{ marginBottom: 12 }}>
          เอกสารนี้ยืนยันแล้ว — การขอตรวจนับใหม่จะส่งแจ้งเตือนให้หัวหน้า Admin อนุมัติก่อน
        </div>
        <p style={{ marginTop: 0, fontSize: 13 }}>
          ใบฝาก: <strong>{selected?.request_no}</strong>
        </p>
        <label className="form-field">
          <span>เหตุผลที่ขอตรวจนับใหม่</span>
          <textarea
            className="form-control"
            rows={3}
            value={recountRequestComment}
            onChange={(e) => setRecountRequestComment(e.target.value)}
            placeholder="ระบุเหตุผล เช่น ตรวจพบความคลาดเคลื่อนหลังยืนยัน..."
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
                  note: recountNote || null,
                });
                setSubmitting(false);
                if (result.error) {
                  setError(result.error.message ?? 'Save failed');
                  return;
                }
                setLines((prev) => prev.map((l) => l.id === recountLine.id
                  ? { ...l, actual_boxes: Number(recountBoxes) || null, actual_weight: Number(recountQty) || null, actual_note: recountNote || null }
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
            <label className="form-field" style={{ marginTop: 8 }}>
              <span>หมายเหตุรายบรรทัด (Admin)</span>
              <input
                className="form-control"
                placeholder="บันทึกหมายเหตุสำหรับรายการนี้..."
                value={recountNote}
                onChange={(e) => setRecountNote(e.target.value)}
              />
            </label>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

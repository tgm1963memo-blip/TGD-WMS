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
  updateDepositLineLocation,
  enqueueCustomerDepositNotification,
} from '../../services/customerDepositRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import { checkLocationHasInventory } from '../../services/inventoryMovementService.js';
import { getCustomers } from '../../services/masterDataService.js';
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
  const [locationLine, setLocationLine] = useState(null);
  const [allLocations, setAllLocations] = useState([]);
  const [locZone, setLocZone] = useState('');
  const [locSide, setLocSide] = useState('');
  const [locRow, setLocRow] = useState('');
  const [locLevel, setLocLevel] = useState('');
  const [customerData, setCustomerData] = useState(null);
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
      if (hRes.data?.customer_id) {
        getCustomers().then((cResult) => {
          if (!active) return;
          const cust = (cResult.data ?? []).find((c) => c.id === hRes.data.customer_id);
          setCustomerData(cust ?? null);
        });
      }
    });

    return () => { active = false; };
  }, [requestId, isOpen]);

  useEffect(() => {
    getActiveLocations().then(({ data }) => setAllLocations(data ?? []));
  }, []);

  // Parse location code into hierarchy parts
  function parseLocCode(code) {
    const m = /^(.+)-([LR])-(\d+)-(\d+)$/i.exec(code ?? '');
    return m ? { zone: m[1], side: m[2].toUpperCase(), row: +m[3], level: +m[4] } : null;
  }

  const parsedAllLocs = allLocations.map((l) => ({ ...l, parsed: parseLocCode(l.code) })).filter((l) => l.parsed);
  const locZoneOptions = [...new Set(parsedAllLocs.map((l) => l.parsed.zone))].sort();
  const locSideOptions = locZone ? [...new Set(parsedAllLocs.filter((l) => l.parsed.zone === locZone).map((l) => l.parsed.side))].sort() : [];
  const locRowOptions = (locZone && locSide) ? [...new Set(parsedAllLocs.filter((l) => l.parsed.zone === locZone && l.parsed.side === locSide).map((l) => l.parsed.row))].sort((a, b) => a - b) : [];
  const locLevelOptions = (locZone && locSide && locRow) ? [...new Set(parsedAllLocs.filter((l) => l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === +locRow).map((l) => l.parsed.level))].sort((a, b) => a - b) : [];
  const selectedLocObj = (locZone && locSide && locRow && locLevel)
    ? (parsedAllLocs.find((l) => l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === +locRow && l.parsed.level === +locLevel) ?? null)
    : null;

  const branding = getDocumentBrandingConfig();

  const printHeader = header ? {
    ...header,
    customer_name: customerData?.customer_name ?? null,
    customer_address: customerData?.address ?? null,
    contact_fax: customerData?.fax ?? null,
    arrival_time: header.reviewed_at
      ? new Date(header.reviewed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : null,
    issued_by: header.handheld_received_by_email ?? null,
    approved_by: header.web_approved_by_email ?? null,
  } : null;

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
  const canRequestRecount = header && ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'].includes(header.status);

  async function handleRequestRecount() {
    if (!requestId) return;
    if (!window.confirm('ต้องการขอให้ handheld ตรวจนับสินค้าใหม่ใช่หรือไม่?\nสถานะเอกสารจะเปลี่ยนเป็น "ขอตรวจนับใหม่" และ handheld จะสามารถอัปเดตจำนวนสินค้าได้')) return;
    setSubmitting(true); setError(''); setActionMsg('');
    const r = await reviewCustomerDepositRequest(requestId, 'REQUEST_RECOUNT', comment);
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'ขอตรวจนับใหม่ล้มเหลว'); return; }
    const newStatus = r.data?.status ?? 'ADMIN_RECOUNT_REQUESTED';
    setActionMsg('ขอตรวจนับใหม่เรียบร้อยแล้ว — handheld สามารถนับสินค้าใหม่ได้');
    updateHeaderStatus(newStatus);
  }

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

  async function handleSaveLocation() {
    if (!locationLine) return;
    const locId = selectedLocObj?.id ?? null;
    setSubmitting(true); setError('');

    if (locId) {
      const hasStock = await checkLocationHasInventory(locId);
      if (hasStock) {
        if (!window.confirm('Location นี้มีสินค้าอยู่แล้ว คุณแน่ใจหรือไม่ที่จะจัดเก็บสินค้าเพิ่มที่นี่?')) {
          setSubmitting(false);
          return;
        }
      }
    }

    const r = await updateDepositLineLocation(locationLine.id, locId, locationLine);
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'Save location failed'); return; }
    setLines((prev) => prev.map((l) =>
      l.id === locationLine.id ? { ...l, location_id: locId } : l,
    ));
    setActionMsg('อัปเดต Location เรียบร้อยแล้ว');
    setLocationLine(null);
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
                    header={printHeader}
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
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('catalog_col_customer_code')}</th>
                      <th>{t('catalog_col_product_name')}</th>
                      <th style={{ textAlign: 'center' }}>LOT</th>
                      <th style={{ textAlign: 'right' }}>น้ำหนักต่อหน่วย (กก.)</th>
                      <th style={{ textAlign: 'right' }}>กล่อง (รับจริง / แจ้งฝาก)</th>
                      <th style={{ textAlign: 'right' }}>น้ำหนัก กก. (รับจริง / แจ้งฝาก)</th>
                      <th>หมายเหตุ (Admin)</th>
                      <th>Location</th>
                      <th>{t('catalog_col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length ? lines.map((line) => {
                      const isConfirmed = header.status === 'RECEIVED_CONFIRMED';
                      const hasVariance = line.actual_boxes != null &&
                        (line.actual_boxes !== line.expected_boxes || String(line.actual_weight) !== String(line.expected_weight));
                      const actualBoxColor = line.actual_boxes == null
                        ? 'var(--tgd-muted-text)'
                        : hasVariance ? 'var(--tgd-warning, #d97706)' : 'var(--tgd-success, #16a34a)';
                      const actualWtColor = line.actual_weight == null
                        ? 'var(--tgd-muted-text)'
                        : (line.actual_weight !== line.expected_weight) ? 'var(--tgd-warning, #d97706)' : 'var(--tgd-success, #16a34a)';
                      const weightPerBox = line.weight_per_box ?? (
                        line.expected_boxes && line.expected_weight
                          ? (Number(line.expected_weight) / Number(line.expected_boxes)).toFixed(2)
                          : null
                      );
                      return (
                        <tr key={line.id} style={hasVariance ? { background: '#fff9e6' } : {}}>
                          <td>{line.line_no}</td>
                          <td>{line.customer_product_code ?? '-'}</td>
                          <td>{line.product_name ?? '-'}</td>
                          <td style={{ textAlign: 'center' }}>{line.lot_no ?? '-'}</td>
                          <td style={{ textAlign: 'right', color: 'var(--tgd-muted-text)' }}>{weightPerBox ?? '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: actualBoxColor }}>
                              {line.actual_boxes != null ? line.actual_boxes : <small>ยังไม่บันทึก</small>}
                            </span>
                            {' '}<span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>/ {line.expected_boxes ?? '-'}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: actualWtColor }}>
                              {line.actual_weight != null ? line.actual_weight : '-'}
                            </span>
                            {' '}<span style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>/ {line.expected_weight ?? '-'}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>{line.actual_note || '—'}</td>
                          <td style={{ fontSize: 12, color: line.location_id ? 'var(--tgd-success)' : 'var(--tgd-muted-text)' }}>
                            {line.location_id
                              ? (allLocations.find((loc) => loc.id === line.location_id)?.code ?? line.location_id)
                              : <small>ยังไม่ระบุ</small>}
                          </td>
                          <td style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              title="อัปเดตตำแหน่งจัดเก็บ"
                              aria-label="Update Location"
                              onClick={() => {
                                setLocationLine(line);
                                const existingLoc = allLocations.find((loc) => loc.id === line.location_id);
                                const p = existingLoc ? parseLocCode(existingLoc.code) : null;
                                setLocZone(p?.zone ?? '');
                                setLocSide(p?.side ?? '');
                                setLocRow(p?.row ? String(p.row) : '');
                                setLocLevel(p?.level ? String(p.level) : '');
                              }}
                            >
                              📍 Location
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              aria-label="Edit Item Quantities"
                              onClick={() => {
                                setRecountLine(line);
                                setRecountBoxes(line.actual_boxes?.toString() ?? line.expected_boxes?.toString() ?? '');
                                setRecountQty(line.actual_weight?.toString() ?? line.expected_weight?.toString() ?? '');
                              }}
                            >
                              🔄 ตรวจนับใหม่
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={10}>{t('customer_request_detail_lines_empty')}</td></tr>
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
              {canRequestRecount ? (
                <button
                  className="btn btn-warning"
                  disabled={submitting}
                  onClick={handleRequestRecount}
                  title="เปลี่ยนสถานะให้ handheld สามารถนับสินค้าใหม่ได้"
                  type="button"
                >
                  🔄 ขอตรวจนับใหม่
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

      {/* Location update modal — only for RECEIVED_CONFIRMED lines */}
      <Modal
        isOpen={!!locationLine}
        onClose={() => { setLocationLine(null); setLocZone(''); setLocSide(''); setLocRow(''); setLocLevel(''); }}
        title="อัปเดต Location"
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-primary" disabled={submitting || !selectedLocObj} type="button" onClick={handleSaveLocation}>
              {t('save')}
            </button>
            <button className="btn btn-secondary" onClick={() => setLocationLine(null)} type="button">{t('cancel')}</button>
          </div>
        )}
      >
        {locationLine ? (
          <>
            <p style={{ marginTop: 0 }}>
              <strong>{locationLine.product_name ?? locationLine.customer_product_code}</strong>
            </p>
            <p style={{ fontSize: 12, color: 'var(--tgd-muted-text)', margin: '0 0 12px' }}>
              ยอดรับ: {locationLine.actual_boxes ?? locationLine.expected_boxes} กล่อง
              {locationLine.actual_weight != null ? ` · ${locationLine.actual_weight} กก.` : ''}
              {' '}(แก้ไขยอดรับไม่ได้)
            </p>
            {parsedAllLocs.length === 0 ? (
              <p style={{ color: 'var(--tgd-danger)', fontSize: 13 }}>ไม่พบข้อมูล Location ในระบบ</p>
            ) : (
              <div className="form-grid" style={{ gap: 10 }}>
                <label className="form-field">
                  <span>ห้อง / โซน</span>
                  <select className="form-control" value={locZone} onChange={(e) => { setLocZone(e.target.value); setLocSide(''); setLocRow(''); setLocLevel(''); }}>
                    <option value="">-- เลือกห้อง --</option>
                    {locZoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>ฝั่ง</span>
                  <select className="form-control" value={locSide} onChange={(e) => { setLocSide(e.target.value); setLocRow(''); setLocLevel(''); }} disabled={!locZone}>
                    <option value="">-- เลือกฝั่ง --</option>
                    {locSideOptions.map((s) => <option key={s} value={s}>{s === 'L' ? 'ซ้าย (L)' : 'ขวา (R)'}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>แถว</span>
                  <select className="form-control" value={locRow} onChange={(e) => { setLocRow(e.target.value); setLocLevel(''); }} disabled={!locSide}>
                    <option value="">-- เลือกแถว --</option>
                    {locRowOptions.map((r) => <option key={r} value={String(r)}>แถว {r}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>ชั้น</span>
                  <select className="form-control" value={locLevel} onChange={(e) => setLocLevel(e.target.value)} disabled={!locRow}>
                    <option value="">-- เลือกชั้น --</option>
                    {locLevelOptions.map((lv) => <option key={lv} value={String(lv)}>ชั้น {lv}</option>)}
                  </select>
                </label>
                {selectedLocObj && (
                  <div style={{ gridColumn: '1/-1', background: 'var(--tgd-success-light, #ecfdf5)', border: '1px solid var(--tgd-success)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                    <strong style={{ color: 'var(--tgd-success)' }}>✓ {selectedLocObj.code}</strong>
                    {selectedLocObj.name && <span style={{ color: '#555', marginLeft: 8 }}>{selectedLocObj.name}</span>}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </>
  );
}

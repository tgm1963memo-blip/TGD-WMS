import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { LoadingState } from '../ui/LoadingState.jsx';
import { DateInputDMY } from '../common/DateInputDMY.jsx';
import { useUserRole } from '../../features/auth/UserRoleProvider.jsx';
import { ReportPrintActions } from '../reports/ReportPrintActions.jsx';
import { CustomerDepositStaffWorkOrderPrint } from './CustomerDepositStaffWorkOrderPrint.jsx';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { getTemperatureTypeLabel, getTemperatureTypeShortLabel } from '../../utils/temperatureTypeLabels.js';
import { printSticker, printStickers, StickerPageSizeControl, StickerRotationControl } from '../../utils/stickerPrint.jsx';
import {
  getCustomerDepositRequest,
  listCustomerDepositRequestLines,
  reviewCustomerDepositRequest,
  recordDepositLineActualReceipt,
  addAdminDepositRequestLine,
  recallConfirmedDepositRequest,
  updateDepositLineLocation,
  enqueueCustomerDepositNotification,
  cancelCustomerDepositRequest,
} from '../../services/customerDepositRequestService.js';
import { listCustomerDocumentTimelineEvents } from '../../services/customerDocumentTimelineService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import { checkLocationHasInventory } from '../../services/inventoryMovementService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { hasWeightVariance } from '../../utils/customerRequestCancelUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';
import { TEMPERATURE_TYPE_LABELS } from '../../utils/temperatureTypeLabels.js';

function fmtDate(v) {
  if (!v) return '-';
  const s = String(v).split('T')[0];
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
}

// Mirrors tgd_admin_add_customer_deposit_request_line's status guard —
// staff can add an extra item any time before receipt is confirmed
// (customer entered the wrong code, or the physical delivery didn't
// include everything they declared).
const ADD_LINE_EXCLUDED_STATUSES = ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED', 'REJECTED', 'CANCELLED'];

// tgd_customer_document_timeline_events.action values this document type
// actually produces (customerDocumentTimelineService.js reads the raw
// table) — friendlier Thai labels for the audit-log view below, action
// codes not listed here just fall back to showing the raw code.
const TIMELINE_ACTION_LABELS = {
  CREATE_DRAFT: 'สร้างร่างเอกสาร',
  UPDATE_DRAFT: 'แก้ไขร่างเอกสาร',
  DELETE_LINE: 'ลบรายการสินค้า',
  SUBMIT: 'ส่งคำขอ',
  RECALL: 'เรียกคืนร่างเอกสาร',
  CANCEL: 'ยกเลิกเอกสาร',
  REVIEW_REVIEWING: 'เริ่มตรวจสอบ',
  REVIEW_ACCEPT: 'เปิดใบงาน (อนุมัติ)',
  REVIEW_REJECT: 'ปฏิเสธคำขอ',
  REVIEW_REQUEST_RECOUNT: 'ขอตรวจนับใหม่',
  REVIEW_CONFIRM_RECEIPT: 'ยืนยันรับเข้าคลัง',
  ADMIN_ADD_LINE: 'เพิ่มรายการสินค้า (Admin)',
  ADMIN_RECALL_CONFIRMED: 'เรียกคืนเอกสารที่ยืนยันแล้ว',
};

function timelineActionLabel(action) {
  return TIMELINE_ACTION_LABELS[action] ?? action;
}

export function CustomerDepositDetailModal({ requestId, isOpen, onClose, onStatusChange }) {
  const t = useTranslation();
  const { role: userRole } = useUserRole();
  const isSystemAdmin = userRole === 'admin';
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyNote, setNotifyNote] = useState('');
  const [recountLine, setRecountLine] = useState(null);
  const [recountBoxes, setRecountBoxes] = useState('');
  const [recountQty, setRecountQty] = useState('');
  const [lotEditLine, setLotEditLine] = useState(null);
  const [lotEditLotNo, setLotEditLotNo] = useState('');
  const [lotEditMfgDate, setLotEditMfgDate] = useState('');
  const [lotEditExpDate, setLotEditExpDate] = useState('');
  const [lotEditProductCode, setLotEditProductCode] = useState('');
  const [locationLine, setLocationLine] = useState(null);
  const [allLocations, setAllLocations] = useState([]);
  const [locZone, setLocZone] = useState('');
  const [locSide, setLocSide] = useState('');
  const [locRow, setLocRow] = useState('');
  const [locLevel, setLocLevel] = useState('');
  const [locBay, setLocBay] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [lineNotes, setLineNotes] = useState({});
  const [savingNote, setSavingNote] = useState({});
  const [selectedLineIds, setSelectedLineIds] = useState(() => new Set());
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [addLineCode, setAddLineCode] = useState('');
  const [addLineName, setAddLineName] = useState('');
  const [addLineLot, setAddLineLot] = useState('');
  const [addLineBoxes, setAddLineBoxes] = useState('');
  const [addLineWeight, setAddLineWeight] = useState('');
  const [addLineTemp, setAddLineTemp] = useState('');
  const [addLineNote, setAddLineNote] = useState('');
  const [addingLine, setAddingLine] = useState(false);
  const [recallConfirmedOpen, setRecallConfirmedOpen] = useState(false);
  const [recallConfirmedComment, setRecallConfirmedComment] = useState('');
  const [recalling, setRecalling] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    if (!requestId || !isOpen) return;
    let active = true;
    setLoading(true);
    setActionMsg('');
    setError('');
    setComment('');
    setSelectedLineIds(new Set());
    setTimelineEvents([]);
    setTimelineOpen(false);

    Promise.all([
      getCustomerDepositRequest(requestId),
      listCustomerDepositRequestLines(requestId),
      listCustomerDocumentTimelineEvents('CUSTOMER_DEPOSIT_REQUEST', requestId),
    ]).then(([hRes, lRes, tRes]) => {
      if (!active) return;
      setHeader(hRes.data ?? null);
      const loadedLines = lRes.data ?? [];
      setLines(loadedLines);
      const initNotes = {};
      loadedLines.forEach((l) => { initNotes[l.id] = l.actual_note ?? ''; });
      setLineNotes(initNotes);
      setTimelineEvents(tRes.data ?? []);
      setLoading(false);
      if (hRes.data?.customer_id) {
        getCustomers().then((cResult) => {
          if (!active) return;
          const cust = (cResult.data ?? []).find((c) => c.id === hRes.data.customer_id);
          setCustomerData(cust ?? null);
        });
        listCustomerProducts({ customerId: hRes.data.customer_id }).then((cpResult) => {
          if (!active) return;
          setCatalogProducts(cpResult.data ?? []);
        });
      }
    });

    return () => { active = false; };
  }, [requestId, isOpen]);

  useEffect(() => {
    getActiveLocations().then(({ data }) => setAllLocations(data ?? []));
  }, []);

  // Parse location code into hierarchy parts (bay/"ตอน" optional so
  // pre-retrofit 4-segment codes still parse, defaulting to bay 1)
  function parseLocCode(code) {
    const m = /^(.+)-([LR])-(\d+)-(\d+)(?:-(\d+))?$/i.exec(code ?? '');
    return m ? { zone: m[1], side: m[2].toUpperCase(), row: +m[3], level: +m[4], bay: m[5] ? +m[5] : 1 } : null;
  }

  const parsedAllLocs = allLocations.map((l) => ({ ...l, parsed: parseLocCode(l.code) })).filter((l) => l.parsed);
  const locZoneOptions = [...new Set(parsedAllLocs.map((l) => l.parsed.zone))].sort();
  const locSideOptions = locZone ? [...new Set(parsedAllLocs.filter((l) => l.parsed.zone === locZone).map((l) => l.parsed.side))].sort() : [];
  const locRowOptions = (locZone && locSide) ? [...new Set(parsedAllLocs.filter((l) => l.parsed.zone === locZone && l.parsed.side === locSide).map((l) => l.parsed.row))].sort((a, b) => a - b) : [];
  const locLevelOptions = (locZone && locSide && locRow) ? [...new Set(parsedAllLocs.filter((l) => l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === +locRow).map((l) => l.parsed.level))].sort((a, b) => a - b) : [];
  const locBayOptions = (locZone && locSide && locRow && locLevel)
    ? [...new Set(parsedAllLocs.filter((l) => l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === +locRow && l.parsed.level === +locLevel).map((l) => l.parsed.bay))].sort((a, b) => a - b)
    : [];
  const selectedLocObj = (locZone && locSide && locRow && locLevel && locBay)
    ? (parsedAllLocs.find((l) => l.parsed.zone === locZone && l.parsed.side === locSide && l.parsed.row === +locRow && l.parsed.level === +locLevel && l.parsed.bay === +locBay) ?? null)
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
  // Mirrors tgd_review_customer_deposit_request's REJECT transition, which
  // only accepts it from ADMIN_REVIEWING (DRAFT/SUBMITTED_BY_CUSTOMER are
  // auto-advanced into REVIEWING first by handleReject, same as
  // handleOpenWorkOrder already does for ACCEPT) — showing this button for
  // any later status (e.g. WAREHOUSE_RECEIVING) let staff fill in a reason
  // and click Reject only to have the RPC always throw "Invalid deposit
  // review transition". Once accepted into a work order, cancelling is the
  // correct action instead (see canCancel below).
  const canReject = header && ['DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(header.status);
  // Fills the gap Reject leaves once a request is already accepted into a
  // work order but not yet completed — mirrors tgd_cancel_customer_deposit_
  // request's admin/accounting status guard (blocked only once terminal).
  const canCancel = header && ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'].includes(header.status);
  const canRequestRecount = header && ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'].includes(header.status);
  // Client-side mirror of tgd_recall_confirmed_deposit_request's 24-hour
  // window check — just for hiding the button once it's obviously too
  // late; the RPC re-checks this authoritatively regardless (a stale
  // client clock or race isn't a real risk since the server rejects it).
  const canRecallConfirmed = header
    && ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED'].includes(header.status)
    && header.last_action_at
    && (Date.now() - new Date(header.last_action_at).getTime()) <= 24 * 60 * 60 * 1000;

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

  async function handleRecallConfirmed() {
    if (!requestId) return;
    setRecalling(true); setError('');
    const r = await recallConfirmedDepositRequest(requestId, recallConfirmedComment || null);
    setRecalling(false);
    if (r.error) { setError(r.error.message ?? 'เรียกคืนไม่สำเร็จ'); return; }
    setActionMsg('เรียกคืนเอกสารกลับมาแก้ไขแล้ว — สามารถแก้ไขจำนวนรับจริงและยืนยันใหม่ได้');
    updateHeaderStatus('WAREHOUSE_RECEIVING');
    setRecallConfirmedOpen(false);
    setRecallConfirmedComment('');
  }

  function updateHeaderStatus(newStatus) {
    setHeader((prev) => prev ? { ...prev, status: newStatus } : prev);
    onStatusChange?.(requestId, newStatus);
    refreshTimeline();
  }

  function refreshTimeline() {
    if (!requestId) return;
    listCustomerDocumentTimelineEvents('CUSTOMER_DEPOSIT_REQUEST', requestId).then((result) => {
      setTimelineEvents(result.data ?? []);
    });
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

  function openAddLine() {
    setAddLineCode(''); setAddLineName(''); setAddLineLot('');
    setAddLineBoxes(''); setAddLineWeight(''); setAddLineTemp(''); setAddLineNote('');
    setError('');
    setAddLineOpen(true);
  }

  async function handleAddLine() {
    if (!requestId || !addLineCode.trim()) return;
    setAddingLine(true); setError('');
    const r = await addAdminDepositRequestLine(requestId, {
      customerProductCode: addLineCode,
      productName: addLineName || null,
      lotNo: addLineLot || null,
      actualBoxes: addLineBoxes,
      actualWeight: addLineWeight,
      temperatureType: addLineTemp || null,
      note: addLineNote || null,
    });
    setAddingLine(false);
    if (r.error) { setError(r.error.message ?? 'เพิ่มรายการไม่สำเร็จ'); return; }
    const linesResult = await listCustomerDepositRequestLines(requestId);
    setLines(linesResult.data ?? []);
    setActionMsg('เพิ่มรายการสินค้าเรียบร้อย');
    setAddLineOpen(false);
    refreshTimeline();
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
    // REJECT is only a valid transition from ADMIN_REVIEWING server-side —
    // advance through REVIEWING first for an as-yet-unopened request, same
    // as handleOpenWorkOrder already does before ACCEPT.
    if (header?.status === 'DRAFT' || header?.status === 'SUBMITTED_BY_CUSTOMER') {
      const rv = await reviewCustomerDepositRequest(requestId, 'REVIEWING', comment);
      if (rv.error) { setSubmitting(false); setError(rv.error.message ?? 'Reject failed'); return; }
    }
    const r = await reviewCustomerDepositRequest(requestId, 'REJECT', rejectReason || comment);
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'Reject failed'); return; }
    const newStatus = r.data?.status ?? 'REJECTED';
    setActionMsg(getDepositStatusLabel(newStatus, t) || newStatus);
    updateHeaderStatus(newStatus);
    setRejectOpen(false);
    setRejectReason('');
  }

  async function handleCancel() {
    if (!requestId) return;
    setSubmitting(true); setError('');
    const r = await cancelCustomerDepositRequest(requestId, cancelReason || comment);
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'ยกเลิกคำขอไม่สำเร็จ'); return; }
    const newStatus = r.data?.status ?? 'CANCELLED';
    setActionMsg(getDepositStatusLabel(newStatus, t) || newStatus);
    updateHeaderStatus(newStatus);
    setCancelOpen(false);
    setCancelReason('');
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

  // System-admin-only: fix LOT no. / mfg / exp date on a line, regardless of the
  // request's current status (confirmed lines can have wrong LOT data too).
  async function handleSaveLotEdit() {
    if (!lotEditLine) return;
    setSubmitting(true); setError('');
    const newProductCode = lotEditProductCode.trim();
    const r = await recordDepositLineActualReceipt(lotEditLine.id, {
      actualBoxes: lotEditLine.actual_boxes,
      actualWeight: lotEditLine.actual_weight,
      note: lotEditLine.actual_note,
      lotNo: lotEditLotNo,
      mfgDate: lotEditMfgDate || null,
      expDate: lotEditExpDate || null,
      locationId: lotEditLine.location_id,
      customerProductCode: newProductCode && newProductCode !== lotEditLine.customer_product_code ? newProductCode : null,
    });
    setSubmitting(false);
    if (r.error) { setError(r.error.message ?? 'Save failed'); return; }
    setLines((prev) => prev.map((l) =>
      l.id === lotEditLine.id
        ? {
            ...l,
            lot_no: lotEditLotNo || l.lot_no,
            mfg_date: lotEditMfgDate || null,
            exp_date: lotEditExpDate || null,
            customer_product_code: r.data?.customer_product_code ?? l.customer_product_code,
            internal_product_code: r.data?.internal_product_code ?? l.internal_product_code,
            product_name: r.data?.product_name ?? l.product_name,
            temperature_type: r.data?.temperature_type ?? l.temperature_type,
          }
        : l,
    ));
    setActionMsg(t('save'));
    setLotEditLine(null);
  }

  function buildStickerItem(line) {
    const catalogMatch = catalogProducts.find((p) => p.customer_product_code === line.customer_product_code);
    const locationCode = allLocations.find((loc) => loc.id === line.location_id)?.code;
    const quantityParts = [];
    if (line.actual_boxes ?? line.expected_boxes) quantityParts.push(`${Number(line.actual_boxes ?? line.expected_boxes).toLocaleString()} กล่อง`);
    if (line.actual_weight ?? line.expected_weight) quantityParts.push(`${formatFixed2(line.actual_weight ?? line.expected_weight)} กก.`);
    return {
      depositDate: header?.expected_arrival_date,
      customerName: customerData?.customer_name ?? customerData?.name ?? header?.contact_name ?? '',
      productCode: line.customer_product_code ?? line.internal_product_code ?? '',
      productName: line.product_name,
      lotNo: line.lot_no,
      storageLabel: getTemperatureTypeShortLabel(line.temperature_type),
      quantityLabel: quantityParts.join(' / ') || '-',
      // The sticker only shows a warning line when this is non-empty — the
      // actual allergen substance (e.g. "นม, ถั่ว"), not a bare yes/no, is
      // what a handler actually needs to read on the printed label.
      allergenLabel: catalogMatch?.allergen || '',
      mfgDate: line.mfg_date,
      locationCode,
      trackingCode: line.tracking_code ?? '-',
    };
  }

  function handlePrintSticker(line) {
    printSticker(buildStickerItem(line));
  }

  function toggleLineSelected(lineId) {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }

  function toggleSelectAllLines() {
    setSelectedLineIds((prev) => {
      const allIds = lines.map((l) => l.id);
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  }

  function handlePrintSelectedStickers() {
    const items = lines.filter((l) => selectedLineIds.has(l.id)).map(buildStickerItem);
    if (!items.length) return;
    printStickers(items);
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
        size="xl"
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
                <div>{fmtDate(header.expected_arrival_date)}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_contact_name')}</div>
                <div>{header.contact_name ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">{t('customer_field_vehicle_registration')}</div>
                <div>{header.vehicle_registration ?? '-'}</div>
              </div>
              <div>
                <div className="form-label">อุณหภูมิจัดเก็บ (ที่ลูกค้าแจ้ง)</div>
                <div style={{ fontWeight: 600, color: header.goods_temp ? 'var(--tgd-primary)' : 'var(--tgd-muted-text)' }}>
                  {header.goods_temp ?? '-'}
                </div>
              </div>
            </div>

            {/* Print actions */}
            <div className="action-row" style={{ marginBottom: 16 }}>
              <ReportPrintActions
                disabled={false}
                orientation="landscape"
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTimelineOpen((v) => !v)}
              >
                📜 {timelineOpen ? 'ซ่อน log การแก้ไข' : `ดู log การแก้ไข (${timelineEvents.length})`}
              </button>
            </div>

            {/* Edit/audit log — every status transition and admin action
                recorded against this document (tgd_customer_document_timeline_events) */}
            {timelineOpen ? (
              <div className="table-card" style={{ marginBottom: 16, padding: 0 }}>
                <div className="responsive-table">
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ whiteSpace: 'nowrap' }}>วันที่/เวลา</th>
                        <th style={{ whiteSpace: 'nowrap' }}>การทำงาน</th>
                        <th style={{ whiteSpace: 'nowrap' }}>สถานะ</th>
                        <th style={{ whiteSpace: 'nowrap' }}>ผู้ทำรายการ</th>
                        <th>หมายเหตุ / รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timelineEvents.length ? timelineEvents.map((ev) => (
                        <tr key={ev.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDocumentDate(ev.created_at)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{timelineActionLabel(ev.action)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {ev.from_status && ev.from_status !== ev.to_status
                              ? `${ev.from_status} → ${ev.to_status}`
                              : (ev.to_status ?? '-')}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {ev.actor_email ?? '-'}
                            {ev.actor_role ? <span style={{ color: 'var(--tgd-muted-text)' }}> ({ev.actor_role})</span> : null}
                          </td>
                          <td>
                            {ev.comment ?? ''}
                            {ev.metadata_json && Object.keys(ev.metadata_json).length ? (
                              <div style={{ color: 'var(--tgd-muted-text)', fontSize: 11 }}>
                                {Object.entries(ev.metadata_json).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5}>ยังไม่มีประวัติการแก้ไข</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Lines table */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>{t('document_lines')}</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  {header && !ADD_LINE_EXCLUDED_STATUSES.includes(header.status) ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={openAddLine}
                      title="สำหรับกรณีลูกค้าใส่รหัสผิด หรือฝากสินค้าเข้ามาไม่ครบตามที่แจ้ง"
                    >
                      ➕ เพิ่มรายการ
                    </button>
                  ) : null}
                  <StickerRotationControl />
                  <StickerPageSizeControl />
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
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          checked={lines.length > 0 && lines.every((l) => selectedLineIds.has(l.id))}
                          onChange={toggleSelectAllLines}
                          title="เลือกทั้งหมด"
                        />
                      </th>
                      <th style={{ whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ whiteSpace: 'nowrap' }}>{t('catalog_col_customer_code')}</th>
                      <th>{t('catalog_col_product_name')}</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>LOT</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>กก./หน่วย</th>
                      <th style={{ whiteSpace: 'nowrap' }}>การจัดเก็บ</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>กล่อง</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>น้ำหนัก กก.</th>
                      <th style={{ whiteSpace: 'nowrap' }}>หมายเหตุ (Admin)</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Location</th>
                      <th style={{ whiteSpace: 'nowrap' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length ? lines.map((line) => {
                      const isConfirmed = header.status === 'RECEIVED_CONFIRMED';
                      const weightVariance = hasWeightVariance(line.actual_weight, line.expected_weight);
                      const hasVariance = line.actual_boxes != null &&
                        (line.actual_boxes !== line.expected_boxes || weightVariance);
                      const actualBoxColor = line.actual_boxes == null
                        ? 'var(--tgd-muted-text)'
                        : hasVariance ? 'var(--tgd-warning, #d97706)' : 'var(--tgd-success, #16a34a)';
                      const actualWtColor = line.actual_weight == null
                        ? 'var(--tgd-muted-text)'
                        : weightVariance ? 'var(--tgd-warning, #d97706)' : 'var(--tgd-success, #16a34a)';
                      const weightPerBox = line.weight_per_box ?? (
                        line.expected_boxes && line.expected_weight
                          ? (Number(line.expected_weight) / Number(line.expected_boxes)).toFixed(2)
                          : null
                      );
                      return (
                        <tr key={line.id} style={hasVariance ? { background: '#fff9e6' } : {}}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedLineIds.has(line.id)}
                              onChange={() => toggleLineSelected(line.id)}
                            />
                          </td>
                          <td>{line.line_no}</td>
                          <td>{line.customer_product_code ?? '-'}</td>
                          <td>{line.product_name ?? '-'}</td>
                          <td style={{ textAlign: 'center' }}>{line.lot_no ?? '-'}</td>
                          <td style={{ textAlign: 'right', color: 'var(--tgd-muted-text)' }}>{weightPerBox ?? '-'}</td>
                          <td>{getTemperatureTypeLabel(line.temperature_type)}</td>
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
                          <td style={{ minWidth: 140 }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: 12, padding: '2px 6px', height: 28 }}
                                placeholder="หมายเหตุ..."
                                value={lineNotes[line.id] ?? line.actual_note ?? ''}
                                onChange={(e) => setLineNotes((prev) => ({ ...prev, [line.id]: e.target.value }))}
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={savingNote[line.id]}
                                style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '2px 8px', height: 28 }}
                                onClick={async () => {
                                  setSavingNote((prev) => ({ ...prev, [line.id]: true }));
                                  const r = await recordDepositLineActualReceipt(line.id, {
                                    actualBoxes: line.actual_boxes,
                                    actualWeight: line.actual_weight,
                                    note: lineNotes[line.id] ?? null,
                                    lotNo: line.lot_no,
                                    mfgDate: line.mfg_date,
                                    expDate: line.exp_date,
                                    locationId: line.location_id,
                                  });
                                  setSavingNote((prev) => ({ ...prev, [line.id]: false }));
                                  if (!r.error) {
                                    setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, actual_note: lineNotes[line.id] } : l));
                                  }
                                }}
                              >
                                {savingNote[line.id] ? '…' : '💾'}
                              </button>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: line.location_id ? 'var(--tgd-success)' : 'var(--tgd-muted-text)' }}>
                            {line.location_id
                              ? (allLocations.find((loc) => loc.id === line.location_id)?.code ?? line.location_id)
                              : <small>ยังไม่ระบุ</small>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              title="อัปเดตตำแหน่งจัดเก็บ"
                              aria-label="Update Location"
                              style={{ marginRight: 4 }}
                              onClick={() => {
                                setLocationLine(line);
                                const existingLoc = allLocations.find((loc) => loc.id === line.location_id);
                                const p = existingLoc ? parseLocCode(existingLoc.code) : null;
                                setLocZone(p?.zone ?? '');
                                setLocSide(p?.side ?? '');
                                setLocRow(p?.row ? String(p.row) : '');
                                setLocLevel(p?.level ? String(p.level) : '');
                                setLocBay(p?.bay ? String(p.bay) : '');
                              }}
                            >
                              📍
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              title="ตรวจนับใหม่"
                              aria-label="Edit Item Quantities"
                              onClick={() => {
                                setRecountLine(line);
                                setRecountBoxes(line.actual_boxes?.toString() ?? line.expected_boxes?.toString() ?? '');
                                setRecountQty(line.actual_weight?.toString() ?? line.expected_weight?.toString() ?? '');
                              }}
                            >
                              🔄
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              title="พิมพ์สติกเกอร์"
                              aria-label="Print Sticker"
                              style={{ marginLeft: 4 }}
                              onClick={() => handlePrintSticker(line)}
                            >
                              🖨
                            </button>
                            {isSystemAdmin ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                type="button"
                                title="แก้ไข LOT / วันผลิต / วันหมดอายุ (Admin)"
                                aria-label="Edit LOT Details"
                                style={{ marginLeft: 4 }}
                                onClick={() => {
                                  setLotEditLine(line);
                                  setLotEditLotNo(line.lot_no ?? '');
                                  setLotEditMfgDate(line.mfg_date ?? '');
                                  setLotEditExpDate(line.exp_date ?? '');
                                  setLotEditProductCode(line.customer_product_code ?? '');
                                }}
                              >
                                ✏️
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={12}>{t('customer_request_detail_lines_empty')}</td></tr>
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
              {canRecallConfirmed ? (
                <button
                  className="btn btn-warning"
                  disabled={submitting}
                  onClick={() => { setRecallConfirmedComment(''); setRecallConfirmedOpen(true); }}
                  title="เรียกเอกสารกลับมาแก้ไขจำนวนรับจริง (ภายใน 24 ชม. หลังยืนยัน และยังไม่มีการเบิกจากใบฝากนี้)"
                  type="button"
                >
                  ↩️ เรียกคืนแก้ไข
                </button>
              ) : null}
              {canReject ? (
                <button className="btn btn-danger" disabled={submitting} onClick={() => setRejectOpen(true)} type="button">
                  {t('admin_reject_request')}
                </button>
              ) : null}
              {canCancel ? (
                <button
                  className="btn btn-danger"
                  disabled={submitting}
                  onClick={() => setCancelOpen(true)}
                  title="ใช้เมื่อลูกค้าแจ้งให้ยกเลิกคำขอนี้ หลังเปิดใบงานรับเข้าแล้ว"
                  type="button"
                >
                  ยกเลิกคำขอ
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

      {/* Cancel modal — for a request already accepted into a work order
          (WAREHOUSE_RECEIVING/PALLETIZING/etc.), where REJECT is no longer
          a valid transition. */}
      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="ยกเลิกคำขอ"
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-danger" disabled={submitting} onClick={handleCancel} type="button">
              ยกเลิกคำขอ
            </button>
            <button className="btn btn-secondary" onClick={() => setCancelOpen(false)} type="button">{t('cancel')}</button>
          </div>
        )}
      >
        <label className="form-field">
          <span>เหตุผลการยกเลิก</span>
          <textarea className="form-control" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="เช่น ลูกค้าแจ้งให้ยกเลิก" />
        </label>
      </Modal>

      {/* Recall an already-confirmed receipt back to WAREHOUSE_RECEIVING —
          reverses the stock movements/balances CONFIRM_RECEIPT created;
          blocked server-side if any of this deposit's stock has already
          been withdrawn. */}
      <Modal
        isOpen={recallConfirmedOpen}
        onClose={() => setRecallConfirmedOpen(false)}
        title="เรียกคืนเอกสารกลับมาแก้ไข"
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-warning" disabled={recalling} onClick={handleRecallConfirmed} type="button">
              {recalling ? '...' : 'ยืนยันเรียกคืน'}
            </button>
            <button className="btn btn-secondary" onClick={() => setRecallConfirmedOpen(false)} type="button">
              {t('cancel')}
            </button>
          </div>
        )}
      >
        <div className="banner banner-warning" style={{ marginBottom: 12 }}>
          ⚠️ เอกสารนี้ยืนยันการรับเข้าแล้ว การเรียกคืนจะย้อนสถานะกลับไปเป็น "คลังรับสินค้า"
          และยกเลิกรายการเคลื่อนไหวสต็อกที่สร้างไว้ — ทำได้เฉพาะภายใน 24 ชั่วโมงหลังยืนยัน
          และจะถูกปฏิเสธหากมีการเบิกสินค้าจากใบฝากนี้ไปแล้ว
        </div>
        <label className="form-field">
          <span>หมายเหตุ (ไม่บังคับ)</span>
          <textarea
            className="form-control"
            rows={3}
            value={recallConfirmedComment}
            onChange={(e) => setRecallConfirmedComment(e.target.value)}
            placeholder="ระบุเหตุผลที่ต้องการเรียกคืน..."
          />
        </label>
      </Modal>

      {/* Add extra line — customer entered the wrong code, or the physical
          delivery didn't include everything they declared */}
      <Modal
        isOpen={addLineOpen}
        onClose={() => setAddLineOpen(false)}
        title="เพิ่มรายการสินค้า"
        size="sm"
        footer={(
          <div className="action-row">
            <button
              className="btn btn-primary"
              disabled={addingLine || !addLineCode.trim()}
              onClick={handleAddLine}
              type="button"
            >
              {addingLine ? '...' : t('save')}
            </button>
            <button className="btn btn-secondary" onClick={() => setAddLineOpen(false)} type="button">
              {t('cancel')}
            </button>
          </div>
        )}
      >
        <div className="banner banner-info" style={{ marginBottom: 12 }}>
          สำหรับกรณีลูกค้าใส่รหัสสินค้าผิด หรือฝากสินค้าเข้ามาไม่ครบตามที่แจ้งไว้ในใบฝากนี้
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>รหัสสินค้าลูกค้า *</span>
            <input className="form-control" value={addLineCode} onChange={(e) => setAddLineCode(e.target.value)} placeholder="เช่น 3200300000411" />
          </label>
          <label className="form-field">
            <span>ชื่อสินค้า (เว้นว่างได้ถ้ามีในแคตตาล็อกลูกค้า)</span>
            <input className="form-control" value={addLineName} onChange={(e) => setAddLineName(e.target.value)} />
          </label>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>LOT</span>
            <input className="form-control" value={addLineLot} onChange={(e) => setAddLineLot(e.target.value)} />
          </label>
          <label className="form-field">
            <span>การจัดเก็บ</span>
            <select className="form-control" value={addLineTemp} onChange={(e) => setAddLineTemp(e.target.value)}>
              <option value="">-- เว้นว่าง (ใช้ตามแคตตาล็อก) --</option>
              {Object.entries(TEMPERATURE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>{t('admin_received_boxes')}</span>
            <input className="form-control" type="number" min={0} value={addLineBoxes} onChange={(e) => setAddLineBoxes(e.target.value)} />
          </label>
          <label className="form-field">
            <span>{t('admin_received_qty')}</span>
            <input className="form-control" type="number" min={0} value={addLineWeight} onChange={(e) => setAddLineWeight(e.target.value)} />
          </label>
        </div>
        <label className="form-field" style={{ marginTop: 8 }}>
          <span>หมายเหตุ (Admin)</span>
          <input
            className="form-control"
            placeholder="เช่น ลูกค้าส่งมาผิดรายการ พบระหว่างตรวจนับ..."
            value={addLineNote}
            onChange={(e) => setAddLineNote(e.target.value)}
          />
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

      {/* Admin-only LOT edit modal — allowed regardless of request status, since a wrong
          LOT/mfg/exp value discovered after confirmation still needs a way to be fixed. */}
      <Modal
        isOpen={!!lotEditLine}
        onClose={() => setLotEditLine(null)}
        title="แก้ไขรายละเอียด LOT (Admin)"
        size="sm"
        footer={(
          <div className="action-row">
            <button className="btn btn-primary" disabled={submitting} type="button" onClick={handleSaveLotEdit}>
              {t('save')}
            </button>
            <button className="btn btn-secondary" onClick={() => setLotEditLine(null)} type="button">{t('cancel')}</button>
          </div>
        )}
      >
        {lotEditLine ? (
          <>
            <p style={{ marginTop: 0 }}>
              <strong>{lotEditLine.product_name ?? lotEditLine.customer_product_code}</strong>
            </p>
            <div className="form-grid" style={{ gap: 10 }}>
              <label className="form-field">
                <span>รหัสสินค้า (Admin)</span>
                <input
                  className="form-control"
                  type="text"
                  value={lotEditProductCode}
                  onChange={(e) => setLotEditProductCode(e.target.value)}
                  placeholder="Customer product code"
                />
              </label>
              <label className="form-field">
                <span>เลข LOT</span>
                <input
                  className="form-control"
                  type="text"
                  value={lotEditLotNo}
                  onChange={(e) => setLotEditLotNo(e.target.value)}
                  placeholder="LOT number"
                />
              </label>
              <label className="form-field">
                <span>วันผลิต</span>
                <DateInputDMY value={lotEditMfgDate} onChange={(e) => setLotEditMfgDate(e.target.value)} />
              </label>
              <label className="form-field">
                <span>วันหมดอายุ</span>
                <DateInputDMY value={lotEditExpDate} onChange={(e) => setLotEditExpDate(e.target.value)} />
              </label>
            </div>
            {lotEditProductCode.trim() && lotEditProductCode.trim() !== lotEditLine.customer_product_code ? (
              <p className="form-helper" style={{ marginTop: 10, marginBottom: 0 }}>
                ⚠️ การเปลี่ยนรหัสสินค้าจะปรับชื่อสินค้าตามรายการสินค้าของลูกค้า (ถ้าพบรหัสใหม่ในแคตตาล็อก) — กระทบยอดคงเหลือ/การเรียกเก็บเงินที่อ้างอิงรายการนี้
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>

      {/* Location update modal — only for RECEIVED_CONFIRMED lines */}
      <Modal
        isOpen={!!locationLine}
        onClose={() => { setLocationLine(null); setLocZone(''); setLocSide(''); setLocRow(''); setLocLevel(''); setLocBay(''); }}
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
                  <select className="form-control" value={locZone} onChange={(e) => { setLocZone(e.target.value); setLocSide(''); setLocRow(''); setLocLevel(''); setLocBay(''); }}>
                    <option value="">-- เลือกห้อง --</option>
                    {locZoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>ฝั่ง</span>
                  <select className="form-control" value={locSide} onChange={(e) => { setLocSide(e.target.value); setLocRow(''); setLocLevel(''); setLocBay(''); }} disabled={!locZone}>
                    <option value="">-- เลือกฝั่ง --</option>
                    {locSideOptions.map((s) => <option key={s} value={s}>{s === 'L' ? 'ซ้าย (L)' : 'ขวา (R)'}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>แถว</span>
                  <select className="form-control" value={locRow} onChange={(e) => { setLocRow(e.target.value); setLocLevel(''); setLocBay(''); }} disabled={!locSide}>
                    <option value="">-- เลือกแถว --</option>
                    {locRowOptions.map((r) => <option key={r} value={String(r)}>แถว {r}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>ชั้น</span>
                  <select className="form-control" value={locLevel} onChange={(e) => { setLocLevel(e.target.value); setLocBay(''); }} disabled={!locRow}>
                    <option value="">-- เลือกชั้น --</option>
                    {locLevelOptions.map((lv) => <option key={lv} value={String(lv)}>ชั้น {lv}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>ตอน</span>
                  <select className="form-control" value={locBay} onChange={(e) => setLocBay(e.target.value)} disabled={!locLevel}>
                    <option value="">-- เลือกตอน --</option>
                    {locBayOptions.map((b) => <option key={b} value={String(b)}>ตอน {b}</option>)}
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

import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useRef, useState } from 'react';
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
  updateWithdrawalLineSource,
  addAdminWithdrawalRequestLine,
} from '../../services/customerWithdrawalRequestService.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { useUserRole } from '../../features/auth/UserRoleProvider.jsx';
import { hasRoleFunctionWriteAccess } from '../../security/roleFunctionPermissions.js';
import { mergeWithdrawalRequestsForPrint } from '../../utils/mergeRequestLinesForPrint.js';
import { exportCustomerWithdrawalDocumentExcel } from '../../utils/customerWithdrawalLineExcelUtils.js';
import { listCustomerDocumentTimelineEvents } from '../../services/customerDocumentTimelineService.js';
import { downloadExcelRows } from '../../utils/excelFileUtils.js';

const REVIEW_STATUSES = ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED', 'WAREHOUSE_PICKING', 'COMPLETED', 'DISPATCHED', 'REJECTED', 'CANCELLED'];

// Mirrors CustomerDepositDetailModal's TIMELINE_ACTION_LABELS — same
// tgd_customer_document_timeline_events table, document_type
// CUSTOMER_WITHDRAWAL_REQUEST instead of CUSTOMER_DEPOSIT_REQUEST, with the
// withdrawal-specific review decisions (SEND_TO_PICKING/CONFIRM_DISPATCH)
// in place of the deposit flow's own decision set.
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
  REVIEW_SEND_TO_PICKING: 'ส่งไปจัดสินค้า (Handheld)',
  REVIEW_CONFIRM_DISPATCH: 'ยืนยันจ่ายออก',
  ADMIN_ADD_LINE: 'เพิ่มรายการสินค้า (Admin)',
  ADMIN_RECALL_COMPLETED: 'เรียกคืนเอกสารที่เสร็จสิ้นแล้ว',
};

function timelineActionLabel(action) {
  return TIMELINE_ACTION_LABELS[action] ?? action;
}

// Requests can only be combined into one printed work order while their
// work order is still active — same set backing this page's own
// canSendToHandheld/canConfirmWithdrawal checks.
const BULK_PRINT_ELIGIBLE_STATUSES = ['ADMIN_ACCEPTED', 'WAREHOUSE_PICKING'];

// A withdrawal line can only be added while the request is actively being
// worked (already accepted, either awaiting or mid-picking) — matches
// tgd_admin_add_customer_withdrawal_request_line's own status guard.
const ADD_LINE_ELIGIBLE_STATUSES = ['ADMIN_ACCEPTED', 'WAREHOUSE_PICKING'];

export function CustomerAdminWithdrawalReviewPage() {
  const t = useTranslation();
  const { role: userRole } = useUserRole();
  const canWrite = hasRoleFunctionWriteAccess(userRole, 'withdrawal_request');
  const [rows, setRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState(() => new Set());
  const [mergedPrint, setMergedPrint] = useState(null);
  const [combining, setCombining] = useState(false);
  const [combineError, setCombineError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);
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
  const [recountWeightLocked, setRecountWeightLocked] = useState(true);
  const [recounting, setRecounting] = useState(false);
  const [lineAdminNotes, setLineAdminNotes] = useState({});
  const [savingAdminNote, setSavingAdminNote] = useState({});
  const [lineTrackingCodes, setLineTrackingCodes] = useState({});
  const [savingTrackingCode, setSavingTrackingCode] = useState({});
  const [lineProductCodes, setLineProductCodes] = useState({});
  const [savingProductCode, setSavingProductCode] = useState({});
  const [lineLotNos, setLineLotNos] = useState({});
  const [savingLotNo, setSavingLotNo] = useState({});
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [addLineCode, setAddLineCode] = useState('');
  const [addLineName, setAddLineName] = useState('');
  const [addLineTrackingCode, setAddLineTrackingCode] = useState('');
  const [addLineLot, setAddLineLot] = useState('');
  const [addLineBoxes, setAddLineBoxes] = useState('');
  const [addLineWeight, setAddLineWeight] = useState('');
  const [addLineNote, setAddLineNote] = useState('');
  const [addingLine, setAddingLine] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [globalSearchText, setGlobalSearchText] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineOpen, setTimelineOpen] = useState(false);

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

  // Re-fetches this request's lines fresh from the DB — including
  // lot_remaining_boxes/weight and picked_boxes/weight, which the printed
  // document relies on to show the balance *after* this withdrawal. Every
  // action below that changes the request's status or a line's picked
  // quantity only patched `rows`/`lines` locally with the new status, never
  // refetching `lines` itself — so a request completed (or picked) without
  // reloading the page kept showing the PRE-withdrawal remaining balance on
  // print, since the print trusts lot_remaining_boxes as already-netted
  // once status is COMPLETED, but that field was never refreshed to match.
  function refreshTimeline(id) {
    if (!id) { setTimelineEvents([]); return; }
    listCustomerDocumentTimelineEvents('CUSTOMER_WITHDRAWAL_REQUEST', id).then((result) => {
      setTimelineEvents(result.data ?? []);
    });
  }

  async function refreshLines(id) {
    if (!id) { setLines([]); return; }
    const result = await listCustomerWithdrawalRequestLines(id);
    const loadedLines = result.data ?? [];
    setLines(loadedLines);
    const initNotes = {};
    const initTrackingCodes = {};
    loadedLines.forEach((l) => {
      initNotes[l.id] = l.admin_note ?? '';
      initTrackingCodes[l.id] = l.tracking_code ?? '';
    });
    setLineAdminNotes(initNotes);
    setLineTrackingCodes(initTrackingCodes);
    // Every action handler that calls refreshLines() after mutating this
    // document also wants its edit/audit log refreshed — folded in here
    // instead of touching each of those call sites individually.
    refreshTimeline(id);
  }

  useEffect(() => {
    let active = true;
    setTimelineOpen(false);
    if (!selectedId) { setLines([]); setTimelineEvents([]); return undefined; }

    listCustomerWithdrawalRequestLines(selectedId).then((result) => {
      if (!active) return;
      const loadedLines = result.data ?? [];
      setLines(loadedLines);
      const initNotes = {};
      const initTrackingCodes = {};
      loadedLines.forEach((l) => {
        initNotes[l.id] = l.admin_note ?? '';
        initTrackingCodes[l.id] = l.tracking_code ?? '';
      });
      setLineAdminNotes(initNotes);
      setLineTrackingCodes(initTrackingCodes);
    });
    refreshTimeline(selectedId);

    return () => { active = false; };
  }, [selectedId]);

  function openAddLine() {
    setAddLineCode('');
    setAddLineName('');
    setAddLineTrackingCode('');
    setAddLineLot('');
    setAddLineBoxes('');
    setAddLineWeight('');
    setAddLineNote('');
    setError('');
    setAddLineOpen(true);
  }

  async function handleAddLine() {
    if (!selectedId || !addLineCode.trim()) return;
    setAddingLine(true);
    setError('');
    const result = await addAdminWithdrawalRequestLine(selectedId, {
      customerProductCode: addLineCode,
      productName: addLineName || null,
      trackingCode: addLineTrackingCode || null,
      lotNo: addLineLot || null,
      requestedBoxes: addLineBoxes || null,
      requestedWeight: addLineWeight || null,
      note: addLineNote || null,
    });
    setAddingLine(false);
    if (result.error) {
      setError(result.error.message ?? 'เพิ่มรายการไม่สำเร็จ');
      return;
    }
    await refreshLines(selectedId);
    setActionMsg('เพิ่มรายการสินค้าเรียบร้อย');
    setAddLineOpen(false);
  }

  function openDetail(id) {
    setSelectedId(id);
    setComment('');
    setActionMsg('');
    setError('');
    setDetailOpen(true);
  }

  const selected = sortedData.find((row) => row.id === selectedId) ?? null;

  const bulkEligibleRows = sortedData.filter((r) => BULK_PRINT_ELIGIBLE_STATUSES.includes(r.status));
  const selectedRequestRows = sortedData
    .filter((r) => selectedRequestIds.has(r.id))
    .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
  const hasCustomerMismatch = new Set(selectedRequestRows.map((r) => r.customer_id)).size > 1;

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

  async function handleCombineSelected(selectedRows) {
    if (selectedRows.length < 2) return;
    setCombining(true);
    setCombineError('');
    const results = await Promise.all(selectedRows.map((r) => listCustomerWithdrawalRequestLines(r.id)));
    if (!isMountedRef.current) return;
    const failed = results.find((r) => r.error);
    if (failed) {
      setCombineError(failed.error.message ?? 'โหลดรายการไม่สำเร็จ');
      setCombining(false);
      return;
    }
    const emptyIndex = results.findIndex((r) => (r.data ?? []).length === 0);
    if (emptyIndex !== -1) {
      const emptyRequest = selectedRows[emptyIndex];
      setCombineError(`เอกสาร ${emptyRequest.withdrawal_no ?? emptyRequest.id} ไม่มีรายการสินค้า — กรุณาเอาออกจากการเลือกก่อนรวม`);
      setCombining(false);
      return;
    }
    const entries = selectedRows.map((r, i) => ({
      header: {
        ...r,
        customer_name: r.customer?.customer_name || r.customer?.name || null,
        customer_address: r.customer?.address ?? null,
        contact_fax: r.customer?.fax ?? null,
      },
      lines: results[i].data ?? [],
    }));
    setMergedPrint(mergeWithdrawalRequestsForPrint(entries));
    setCombining(false);
  }

  // Exports whichever requests are currently checked, or every row the
  // active filters currently show when nothing's checked — mirrors
  // CustomerDepositNotificationsSection's bulk export. Unlike
  // exportCustomerWithdrawalDocumentExcel (one document's print-formatted
  // layout at a time), this is a flat, filterable multi-document dump for
  // staff who need line-item detail across many requests at once.
  async function handleExportExcel(rowsToExport) {
    if (!rowsToExport.length) return;
    setExporting(true);
    setExportError('');
    const results = await Promise.all(rowsToExport.map((r) => listCustomerWithdrawalRequestLines(r.id)));
    if (!isMountedRef.current) return;
    const failed = results.find((r) => r.error);
    if (failed) {
      setExportError(failed.error.message ?? 'โหลดรายการไม่สำเร็จ');
      setExporting(false);
      return;
    }

    const exportRows = rowsToExport.flatMap((request, i) => {
      const requestLines = results[i].data ?? [];
      const requestFields = {
        เลขที่คำขอ: request.withdrawal_no ?? '',
        ลูกค้า: request.customer?.customer_name || request.customer?.name || request.customer_id || '',
        สถานะ: getWithdrawalStatusLabel(request.status, t),
        วันที่แจ้งเบิก: formatDocumentDate(request.requested_dispatch_date, { dateOnly: true }),
        ปลายทาง: request.destination ?? '',
        ผู้ติดต่อรับสินค้า: request.pickup_contact ?? '',
        หมายเหตุคำขอ: request.note ?? '',
      };
      if (requestLines.length === 0) {
        return [{ ...requestFields, รหัสสินค้า: '', ชื่อสินค้า: '', Lot: '', รหัสติดตาม: '', จำนวนกล่องที่ขอเบิก: '', น้ำหนักที่ขอเบิก: '', จำนวนกล่องที่จ่ายจริง: '', น้ำหนักที่จ่ายจริง: '', หมายเหตุรายการ: '' }];
      }
      return requestLines.map((line) => ({
        ...requestFields,
        รหัสสินค้า: line.customer_product_code ?? '',
        ชื่อสินค้า: line.product_name ?? '',
        Lot: line.lot_no ?? '',
        รหัสติดตาม: line.tracking_code ?? '',
        จำนวนกล่องที่ขอเบิก: line.requested_boxes ?? '',
        น้ำหนักที่ขอเบิก: line.requested_weight ?? '',
        จำนวนกล่องที่จ่ายจริง: line.picked_boxes ?? '',
        น้ำหนักที่จ่ายจริง: line.picked_weight ?? '',
        หมายเหตุรายการ: line.admin_note ?? line.note ?? '',
      }));
    });

    downloadExcelRows(
      exportRows,
      ['เลขที่คำขอ', 'ลูกค้า', 'สถานะ', 'วันที่แจ้งเบิก', 'ปลายทาง', 'ผู้ติดต่อรับสินค้า', 'หมายเหตุคำขอ', 'รหัสสินค้า', 'ชื่อสินค้า', 'Lot', 'รหัสติดตาม', 'จำนวนกล่องที่ขอเบิก', 'น้ำหนักที่ขอเบิก', 'จำนวนกล่องที่จ่ายจริง', 'น้ำหนักที่จ่ายจริง', 'หมายเหตุรายการ'],
      `withdrawal-requests-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'รายการแจ้งเบิก',
      [16, 28, 16, 14, 20, 20, 20, 14, 30, 20, 14, 14, 14, 14, 14, 20],
    );
    setExporting(false);
  }

  const branding = getDocumentBrandingConfig();

  const canOpenWorkOrder = canWrite && selected && ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(selected.status);
  const canSendToHandheld = canWrite && selected && selected.status === 'ADMIN_ACCEPTED';
  // A line with BOTH picked_boxes and picked_weight still null was never
  // actually picked/weighed — boxes-only or weight-only is a legitimate
  // real pick (see the handheld page's own lock-weight-to-boxes toggle),
  // only "neither" blocks confirming. Mirrors the same guard the RPC
  // itself now enforces server-side (tgd_review_customer_withdrawal_
  // request) — this page previously had NO check at all here, unlike the
  // handheld picking page's own "complete" button (gated on picked_at),
  // which is how 45 real withdrawal requests reached COMPLETED with every
  // line's picked_boxes/picked_weight still null.
  const allLinesHavePickedQty = lines.length > 0 && lines.every((l) => l.picked_boxes != null || l.picked_weight != null);
  const canConfirmWithdrawal = canWrite && selected && selected.status === 'WAREHOUSE_PICKING' && allLinesHavePickedQty;
  const confirmWithdrawalBlockedReason = canWrite && selected && selected.status === 'WAREHOUSE_PICKING' && !allLinesHavePickedQty
    ? 'กรุณายืนยันจำนวนที่เบิกจริงทุกรายการก่อนยืนยันจ่าย'
    : '';
  // Mirrors tgd_review_customer_withdrawal_request's REJECT transition,
  // which only accepts it from SUBMITTED_BY_CUSTOMER or ADMIN_REVIEWING -
  // showing this button for any later status (e.g. WAREHOUSE_PICKING) let
  // staff fill in a reason and click Reject only to have the RPC always
  // throw "Invalid ... transition" (same bug already fixed on the deposit
  // side). canCancel already covers every one of those later statuses, so
  // narrowing this doesn't remove any capability.
  const canReject = canWrite && selected && ['SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING'].includes(selected.status);
  const canCancel = canWrite && selected && !['COMPLETED', 'DISPATCHED', 'CANCELLED', 'REJECTED', 'ADMIN_REJECTED'].includes(selected.status);

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
      await refreshLines(selectedId);
      return;
    }
    const newStatus = pickResult.data?.status ?? 'WAREHOUSE_PICKING';
    setActionMsg(`${t('admin_work_order_opened')} — ${t('admin_sent_to_handheld')}`);
    setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, status: newStatus } : r)));
    await refreshLines(selectedId);
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
    await refreshLines(selectedId);
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
    // Refetch before opening the notify/print flow — the printed document
    // shows lines' lot_remaining_boxes/weight as already-netted once status
    // is COMPLETED, so it must reflect this exact withdrawal's own effect,
    // not whatever was cached from before this action ran (see refreshLines).
    await refreshLines(selectedId);
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
    await refreshLines(selectedId);
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
    await refreshLines(selectedId);
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
    // Also refresh lot_remaining_boxes/weight in the background — a recount
    // changes what's actually been taken, which the printed document's
    // remaining-balance figure depends on (see refreshLines).
    refreshLines(selectedId);
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
        <div className="table-card-header" style={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>{t('admin_withdrawal_review_table_title')}</h3>
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
            <button
              type="button"
              className="btn btn-outline"
              data-testid="withdrawal-review-export-excel"
              disabled={exporting || filteredRows.length === 0}
              onClick={() => handleExportExcel(filteredRows)}
              style={{ alignSelf: 'flex-end' }}
              title="ดาวน์โหลดรายละเอียดสินค้าแต่ละรายการของทุกคำขอที่กรองอยู่ตอนนี้เป็น Excel"
            >
              {exporting ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด Excel'}
            </button>
          </div>
        </div>
        {exportError ? (
          <div className="banner banner-danger" role="alert" style={{ margin: '0 20px 12px' }}>{exportError}</div>
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
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginLeft: 8 }}
              onClick={() => exportCustomerWithdrawalDocumentExcel(mergedPrint.header, mergedPrint.lines)}
            >
              ดาวน์โหลด Excel
            </button>
          </div>
        )}
        <div className="responsive-table">
          <table className="data-table" data-testid="admin-withdrawal-review-table">
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
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`เลือก ${row.withdrawal_no}`}
                      disabled={!BULK_PRINT_ELIGIBLE_STATUSES.includes(row.status)}
                      checked={selectedRequestIds.has(row.id)}
                      onChange={() => toggleRequestSelected(row.id)}
                    />
                  </td>
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
                <tr><td colSpan={7}>{t('admin_withdrawal_review_empty')}</td></tr>
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
        footer={selected ? (
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
            {selected && selected.status === 'WAREHOUSE_PICKING' ? (
              <button
                className="btn btn-primary"
                data-testid="btn-confirm-withdrawal"
                disabled={submitting || !canConfirmWithdrawal}
                onClick={handleConfirmWithdrawal}
                title={confirmWithdrawalBlockedReason}
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
              <div>
                <div className="form-label">{t('customer_field_r3_document')}</div>
                <div>{selected.requires_r3_document ? '✔' : '-'}</div>
              </div>
            </div>

            {/* Print action */}
            <div className="action-row" style={{ marginBottom: 16 }}>
              <ReportPrintActions
                disabled={false}
                orientation="landscape"
                renderReport={(language) => (
                  <CustomerWithdrawalRequestPrintDocument
                    branding={branding}
                    header={selected}
                    language={language}
                    lines={lines}
                    isStaff={true}
                  />
                )}
                title={selected.withdrawal_no}
              />
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginLeft: 8 }}
                onClick={() => exportCustomerWithdrawalDocumentExcel(selected, lines)}
              >
                ดาวน์โหลด Excel
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: 8 }}
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
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--tgd-muted-text)' }}>ไม่มีประวัติการแก้ไข</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Lines table with actual qty column and recount button */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>{t('document_lines')}</h4>
                {canWrite && ADD_LINE_ELIGIBLE_STATUSES.includes(selected.status) ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={openAddLine}
                  >
                    ➕ เพิ่มรายการ
                  </button>
                ) : null}
              </div>
              <div className="responsive-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('catalog_col_customer_code')}</th>
                      <th>{t('catalog_col_product_name')}</th>
                      <th>รหัสติดตาม</th>
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
                        <td style={{ minWidth: 130 }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: 12, padding: '2px 6px', height: 28 }}
                              placeholder="รหัสสินค้า..."
                              value={lineProductCodes[line.id] ?? line.customer_product_code ?? ''}
                              onChange={(e) => setLineProductCodes((prev) => ({ ...prev, [line.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={!canWrite || savingProductCode[line.id]}
                              style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '2px 8px', height: 28 }}
                              onClick={async () => {
                                setSavingProductCode((prev) => ({ ...prev, [line.id]: true }));
                                const r = await updateWithdrawalLineSource(line.id, { customerProductCode: lineProductCodes[line.id] ?? '' });
                                setSavingProductCode((prev) => ({ ...prev, [line.id]: false }));
                                if (!r.error) {
                                  setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, ...r.data } : l));
                                } else {
                                  setError(r.error.message ?? 'บันทึกรหัสสินค้าไม่สำเร็จ');
                                }
                              }}
                            >
                              {savingProductCode[line.id] ? '…' : '💾'}
                            </button>
                          </div>
                        </td>
                        <td>{line.product_name ?? '-'}</td>
                        <td style={{ minWidth: 140 }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: 12, padding: '2px 6px', height: 28 }}
                              placeholder="รหัสติดตาม..."
                              value={lineTrackingCodes[line.id] ?? line.tracking_code ?? ''}
                              onChange={(e) => setLineTrackingCodes((prev) => ({ ...prev, [line.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={!canWrite || savingTrackingCode[line.id]}
                              style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '2px 8px', height: 28 }}
                              onClick={async () => {
                                setSavingTrackingCode((prev) => ({ ...prev, [line.id]: true }));
                                const r = await updateWithdrawalLineSource(line.id, { trackingCode: lineTrackingCodes[line.id] ?? '' });
                                setSavingTrackingCode((prev) => ({ ...prev, [line.id]: false }));
                                if (!r.error) {
                                  setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, ...r.data } : l));
                                  setLineProductCodes((prev) => ({ ...prev, [line.id]: r.data.customer_product_code ?? '' }));
                                  setLineLotNos((prev) => ({ ...prev, [line.id]: r.data.lot_no ?? '' }));
                                } else {
                                  setError(r.error.message ?? 'บันทึกรหัสติดตามไม่สำเร็จ');
                                }
                              }}
                            >
                              {savingTrackingCode[line.id] ? '…' : '💾'}
                            </button>
                          </div>
                        </td>
                        <td style={{ minWidth: 110 }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: 12, padding: '2px 6px', height: 28 }}
                              placeholder="ลอต..."
                              value={lineLotNos[line.id] ?? line.lot_no ?? ''}
                              onChange={(e) => setLineLotNos((prev) => ({ ...prev, [line.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={!canWrite || savingLotNo[line.id]}
                              style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '2px 8px', height: 28 }}
                              onClick={async () => {
                                setSavingLotNo((prev) => ({ ...prev, [line.id]: true }));
                                const r = await updateWithdrawalLineSource(line.id, { lotNo: lineLotNos[line.id] ?? '' });
                                setSavingLotNo((prev) => ({ ...prev, [line.id]: false }));
                                if (!r.error) {
                                  setLines((prev) => prev.map((l) => l.id === line.id ? { ...l, ...r.data } : l));
                                } else {
                                  setError(r.error.message ?? 'บันทึกลอตไม่สำเร็จ');
                                }
                              }}
                            >
                              {savingLotNo[line.id] ? '…' : '💾'}
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ marginBottom: 2 }}>
                            <span
                              className={`status-badge ${line.picked_at != null ? 'status-badge--confirmed' : 'status-badge--uat'}`}
                              style={{ fontSize: 10 }}
                            >
                              {line.picked_at != null ? 'จัดแล้ว' : 'รอดำเนินการ'}
                            </span>
                          </div>
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
                              disabled={!canWrite || savingAdminNote[line.id]}
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
                          {(canWrite && !['COMPLETED', 'DISPATCHED', 'CANCELLED', 'REJECTED'].includes(selected?.status))
                            || (userRole === 'admin' && !['CANCELLED', 'REJECTED'].includes(selected?.status)) ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              onClick={() => {
                                setRecountLine(line);
                                setRecountBoxes((line.picked_boxes ?? line.requested_boxes ?? '').toString());
                                setRecountWeight((line.picked_weight ?? line.requested_weight ?? '').toString());
                                setRecountQty((line.picked_qty ?? line.requested_qty ?? '').toString());
                                setRecountWeightLocked(true);
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

            {/* Warning when confirm dispatch is blocked */}
            {confirmWithdrawalBlockedReason ? (
              <div className="banner banner-warning" role="status" style={{ marginBottom: 12 }}>
                ⚠️ {confirmWithdrawalBlockedReason}
              </div>
            ) : null}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setRecountBoxes(val);
                    if (recountLine?.resolved_weight_per_box && recountWeightLocked) {
                      setRecountWeight(val !== '' ? (Number(val) * recountLine.resolved_weight_per_box).toFixed(2) : '');
                    }
                  }}
                />
              </label>
              <label className="form-field">
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span>น้ำหนักที่หยิบจริง (กก.)</span>
                  {recountLine?.resolved_weight_per_box ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm"
                      style={{ fontSize: 11, padding: 0 }}
                      onClick={() => setRecountWeightLocked((prev) => !prev)}
                    >
                      {recountWeightLocked ? 'แก้ไขน้ำหนักเอง' : 'คำนวณอัตโนมัติ'}
                    </button>
                  ) : null}
                </span>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  step={0.001}
                  disabled={Boolean(recountLine?.resolved_weight_per_box) && recountWeightLocked}
                  value={recountWeight}
                  onChange={(e) => setRecountWeight(e.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}
      </Modal>

      {/* Add extra line — the notified lot doesn't have enough stock to
          cover the requested quantity, so staff need a SEPARATE line
          sourced from a different lot/tracking code for the shortfall,
          rather than retagging the one existing line (which would just
          swap the source, not add to it). */}
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
          สำหรับกรณี lot ที่ลูกค้าแจ้งมามีสินค้าไม่เพียงพอ — เพิ่มรายการนี้เพื่อเบิกส่วนที่ขาดจาก lot/รหัสติดตามอื่น
        </div>
        {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 8 }}>{error}</div> : null}
        <div className="form-grid">
          <label className="form-field">
            <span>รหัสสินค้าลูกค้า *</span>
            <input
              className="form-control"
              value={addLineCode}
              onChange={(e) => setAddLineCode(e.target.value)}
              placeholder="เช่น 10440-17"
            />
          </label>
          <label className="form-field">
            <span>ชื่อสินค้า (เว้นว่างได้ถ้ามีในแคตตาล็อกลูกค้า)</span>
            <input
              className="form-control"
              value={addLineName}
              onChange={(e) => setAddLineName(e.target.value)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>รหัสติดตาม (lot ที่จะเบิกแทน)</span>
            <input
              className="form-control"
              value={addLineTrackingCode}
              onChange={(e) => setAddLineTrackingCode(e.target.value)}
              placeholder="เว้นว่างถ้าให้ระบบเลือกอัตโนมัติ (FEFO)"
            />
          </label>
          <label className="form-field">
            <span>LOT</span>
            <input className="form-control" value={addLineLot} onChange={(e) => setAddLineLot(e.target.value)} />
          </label>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>กล่องที่ต้องการเบิกเพิ่ม</span>
            <input
              className="form-control"
              type="number"
              min={0}
              value={addLineBoxes}
              onChange={(e) => setAddLineBoxes(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>น้ำหนัก (กก.)</span>
            <input
              className="form-control"
              type="number"
              min={0}
              step={0.01}
              value={addLineWeight}
              onChange={(e) => setAddLineWeight(e.target.value)}
            />
          </label>
        </div>
        <label className="form-field" style={{ marginTop: 8 }}>
          <span>หมายเหตุ (Admin)</span>
          <input
            className="form-control"
            placeholder="เช่น lot เดิมมีไม่พอ เบิกเพิ่มจาก lot อื่นแทน..."
            value={addLineNote}
            onChange={(e) => setAddLineNote(e.target.value)}
          />
        </label>
      </Modal>
    </section>
  );
}

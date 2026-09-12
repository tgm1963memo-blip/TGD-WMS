import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerWithdrawalRequestLinesDisplay } from '../../components/customer/CustomerWithdrawalRequestLinesDisplay.jsx';
import { CustomerWithdrawalRequestPrintDocument } from '../../components/customer/CustomerWithdrawalRequestPrintDocument.jsx';
import { CustomerSalesOrderImportModal } from '../../components/customer/CustomerSalesOrderImportModal.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getWithdrawalStatusLabel } from '../../utils/customerWithdrawalStatusLabels.js';
import { listCustomerWithdrawalRequests, listCustomerWithdrawalRequestLines, listWithdrawalLineDetailsForDocs, listWithdrawalLinePalletCodesForLines, cancelCustomerWithdrawalRequest, recallCustomerWithdrawalRequest } from '../../services/customerWithdrawalRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { buildCustomerRequestCopyPath } from '../../utils/customerRequestCopyUtils.js';
import { getWithdrawalRecallEligibility } from '../../utils/customerRequestCancelUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { downloadExcelRows } from '../../utils/excelFileUtils.js';

export function CustomerWithdrawalRequestListPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests, isRequestProxy, role, loading: profileLoading } = useCustomerPortalProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [customerNames, setCustomerNames] = useState({});
  const [detailRow, setDetailRow] = useState(null);
  const [detailLines, setDetailLines] = useState([]);
  const [detailLinesLoading, setDetailLinesLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [recallingId, setRecallingId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRequestIds, setSelectedRequestIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const isMountedRef = useRef(true);
  const { sortedData, requestSort, getSortIndicator } = useTableSort(state.rows);
  const branding = getDocumentBrandingConfig();

  useEffect(() => () => { isMountedRef.current = false; }, []);

  useEffect(() => {
    let active = true;

    if (profileLoading) return undefined;

    if (!isRequestProxy && !customerId) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    const filters = isRequestProxy ? {} : { customerId };

    listCustomerWithdrawalRequests(filters).then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    if (isRequestProxy) {
      getCustomers().then((result) => {
        if (!active) return;
        const names = {};
        (result.data ?? []).forEach((customer) => {
          names[customer.id] = customer.customer_name ?? customer.customer_code ?? customer.id;
        });
        setCustomerNames(names);
      });
    }

    return () => {
      active = false;
    };
  }, [customerId, profileLoading, isRequestProxy, refreshKey]);

  const columnCount = (isRequestProxy ? 9 : 8) + 1;
  const DELETABLE_STATUSES = new Set(['DRAFT', 'WITHDRAWAL_DRAFT', 'DEPOSIT_DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING']);

  async function handleDelete(requestId) {
    setDeleting(true);
    const result = await cancelCustomerWithdrawalRequest(requestId, 'ลบโดยผู้ใช้งาน');
    setDeleting(false);
    setDeleteConfirmId(null);
    if (result.error) {
      setState((current) => ({ ...current, error: result.error }));
      return;
    }
    setState((current) => ({
      ...current,
      rows: current.rows.map((r) => r.id === requestId ? { ...r, status: 'CANCELLED' } : r),
    }));
  }

  async function handleRecall(requestId) {
    if (!window.confirm('ต้องการเรียกเอกสารกลับมาแก้ไขใช่หรือไม่?\nสถานะเอกสารจะกลับเป็น "ร่าง" และหลุดออกจากคิวตรวจสอบของเจ้าหน้าที่จนกว่าจะส่งใหม่')) return;
    setRecallingId(requestId);
    const result = await recallCustomerWithdrawalRequest(requestId);
    setRecallingId(null);
    if (result.error) {
      setState((current) => ({ ...current, error: result.error }));
      return;
    }
    setState((current) => ({
      ...current,
      rows: current.rows.map((r) => r.id === requestId ? { ...r, status: 'WITHDRAWAL_DRAFT' } : r),
    }));
  }

  // Shared between the desktop table's action cell and the mobile card
  // view's action row (see .list-card-view in styles.css) -- same buttons,
  // same conditions, just a different container so it isn't duplicated.
  function renderRowActions(row) {
    if (deleteConfirmId === row.id) {
      return (
        <>
          <button className="btn btn-danger btn-sm" disabled={deleting} onClick={() => handleDelete(row.id)} type="button">
            {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={deleting} onClick={() => setDeleteConfirmId(null)} type="button">ยกเลิก</button>
        </>
      );
    }
    return (
      <>
        {isRequestProxy ? (
          <button
            className="btn btn-secondary btn-sm"
            data-testid={`customer-withdrawal-view-${row.id}`}
            onClick={() => openDetail(row)}
            type="button"
          >
            {t('customer_request_view_button')}
          </button>
        ) : (
          <Link
            className="btn btn-secondary btn-sm"
            data-testid={`customer-withdrawal-view-${row.id}`}
            to={`/customer/withdrawal-request/${row.id}`}
          >
            {t('customer_request_view_button')}
          </Link>
        )}
        {(row.status === 'DRAFT' || row.status === 'WITHDRAWAL_DRAFT' || row.status === 'DEPOSIT_DRAFT') && canWriteCustomerRequests ? (
          <Link
            className="btn btn-primary btn-sm"
            data-testid={`customer-withdrawal-edit-${row.id}`}
            to={`/customer/withdrawal-request/new?editId=${row.id}`}
          >
            {t('edit') || 'แก้ไข'}
          </Link>
        ) : null}
        {canWriteCustomerRequests ? (
          <Link
            className="btn btn-secondary btn-sm"
            data-testid={`customer-withdrawal-copy-${row.id}`}
            to={buildCustomerRequestCopyPath('/customer/withdrawal-request/new', row.id)}
          >
            {t('customer_request_copy_button')}
          </Link>
        ) : null}
        {canWriteCustomerRequests && getWithdrawalRecallEligibility(row, role).canRecall ? (
          <button
            className="btn btn-secondary btn-sm"
            data-testid={`customer-withdrawal-recall-${row.id}`}
            disabled={recallingId === row.id}
            onClick={() => handleRecall(row.id)}
            title="ดึงเอกสารกลับมาเป็นร่างเพื่อแก้ไข ก่อนที่เจ้าหน้าที่จะเปิดใบงาน"
            type="button"
          >
            {recallingId === row.id ? 'กำลังเรียกกลับ...' : '↩ เรียกเอกสารกลับ'}
          </button>
        ) : null}
        {canWriteCustomerRequests && DELETABLE_STATUSES.has(row.status) ? (
          <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirmId(row.id)} type="button">ลบ</button>
        ) : null}
      </>
    );
  }

  function openDetail(row) {
    setDetailRow(row);
    setDetailLines([]);
    setDetailLinesLoading(true);
    listCustomerWithdrawalRequestLines(row.id).then((result) => {
      setDetailLines(result.data ?? []);
      setDetailLinesLoading(false);
    });
  }

  const effectiveCustomerId = isRequestProxy ? filterCustomer : customerId;

  const q = searchText.trim().toLowerCase();
  const filteredData = sortedData.filter((row) => {
    if (q) {
      const customerName = (customerNames[row.customer_id] ?? '').toLowerCase();
      const textMatch = (row.withdrawal_no ?? '').toLowerCase().includes(q) ||
        (row.status ?? '').toLowerCase().includes(q) ||
        (row.note ?? '').toLowerCase().includes(q) ||
        customerName.includes(q);
      if (!textMatch) return false;
    }
    if (filterCustomer && row.customer_id !== filterCustomer) return false;
    const date = row.requested_dispatch_date ?? '';
    if (filterDateFrom && date < filterDateFrom) return false;
    if (filterDateTo && date > filterDateTo) return false;
    return true;
  });
  const selectedRequestRows = filteredData.filter((r) => selectedRequestIds.has(r.id));

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

  // Exports whichever requests are currently checked, or every row the
  // active filters currently show when nothing's checked -- mirrors
  // CustomerAdminWithdrawalReviewPage's bulk export, minus its
  // BULK_PRINT_ELIGIBLE_STATUSES restriction (that gate only applies to the
  // separate "combine into one print job" feature there, not export). Lines
  // for every requested document are fetched in one .in() query
  // (listWithdrawalLineDetailsForDocs) instead of one round-trip per
  // document -- a per-document fetch loop stalled the browser once a
  // filtered list ran into the hundreds (confirmed via load test on the
  // equivalent admin export).
  async function handleExportExcel(rowsToExport) {
    if (!rowsToExport.length) return;
    setExporting(true);
    setExportError('');
    const linesResult = await listWithdrawalLineDetailsForDocs(rowsToExport.map((r) => r.id));
    if (!isMountedRef.current) return;
    if (linesResult.error) {
      setExportError(linesResult.error.message ?? 'โหลดรายการไม่สำเร็จ');
      setExporting(false);
      return;
    }
    const linesByRequestId = new Map();
    (linesResult.data ?? []).forEach((line) => {
      const key = line.withdrawal_request_id;
      if (!linesByRequestId.has(key)) linesByRequestId.set(key, []);
      linesByRequestId.get(key).push(line);
    });
    const palletCodesByLineId = await listWithdrawalLinePalletCodesForLines((linesResult.data ?? []).map((l) => l.id));

    const exportRows = rowsToExport.flatMap((request) => {
      const requestLines = linesByRequestId.get(request.id) ?? [];
      const requestFields = {
        เลขที่คำขอ: request.withdrawal_no ?? '',
        ลูกค้า: request.customer?.customer_name || request.customer?.name || customerNames[request.customer_id] || request.customer_id || '',
        สถานะ: getWithdrawalStatusLabel(request.status, t),
        วันที่แจ้งเบิก: formatDocumentDate(request.requested_dispatch_date, { dateOnly: true }),
        ปลายทาง: request.destination ?? '',
        ผู้ติดต่อรับสินค้า: request.pickup_contact ?? '',
        หมายเหตุคำขอ: request.note ?? '',
      };
      if (requestLines.length === 0) {
        return [{ ...requestFields, รหัสสินค้า: '', ชื่อสินค้า: '', Lot: '', รหัสติดตาม: '', จำนวนกล่องที่ขอเบิก: '', น้ำหนักที่ขอเบิก: '', จำนวนกล่องที่จ่ายจริง: '', น้ำหนักที่จ่ายจริง: '', ตำแหน่งจัดเก็บ: '', หมายเหตุรายการ: '' }];
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
        ตำแหน่งจัดเก็บ: (palletCodesByLineId.get(line.id) ?? []).join(', '),
        หมายเหตุรายการ: line.admin_note ?? line.note ?? '',
      }));
    });

    downloadExcelRows(
      exportRows,
      ['เลขที่คำขอ', 'ลูกค้า', 'สถานะ', 'วันที่แจ้งเบิก', 'ปลายทาง', 'ผู้ติดต่อรับสินค้า', 'หมายเหตุคำขอ', 'รหัสสินค้า', 'ชื่อสินค้า', 'Lot', 'รหัสติดตาม', 'จำนวนกล่องที่ขอเบิก', 'น้ำหนักที่ขอเบิก', 'จำนวนกล่องที่จ่ายจริง', 'น้ำหนักที่จ่ายจริง', 'ตำแหน่งจัดเก็บ', 'หมายเหตุรายการ'],
      `withdrawal-requests-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'รายการแจ้งเบิก',
      [16, 28, 16, 14, 20, 20, 20, 14, 30, 20, 14, 14, 14, 14, 14, 24, 20],
    );
    setExporting(false);
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-withdrawal-request-page">
      <PageHeader
        title={t('customer_withdrawal_title')}
        description={isRequestProxy ? t('customer_withdrawal_list_proxy_description') : t('customer_withdrawal_list_description')}
        actions={canWriteCustomerRequests ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              data-testid="customer-withdrawal-import-so-button"
              disabled={!effectiveCustomerId}
              title={!effectiveCustomerId ? 'เลือกลูกค้าก่อน' : undefined}
              onClick={() => setImportOpen(true)}
              type="button"
            >
              นำเข้าจากไฟล์ Sales Order
            </button>
            <Link className="btn btn-primary" data-testid="customer-withdrawal-create-button" to="/customer/withdrawal-request/new">
              {t('customer_withdrawal_create_button')}
            </Link>
          </div>
        ) : null}
      />
      <CustomerPortalLiveBanner />

      <CustomerSalesOrderImportModal
        customerId={effectiveCustomerId}
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setRefreshKey((k) => k + 1)}
      />

      {isRequestProxy ? (
        <div className="banner banner-info" role="status">{t('customer_request_proxy_scope_banner')}</div>
      ) : null}

      {!isRequestProxy && !customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      {exportError ? (
        <div className="banner banner-danger" role="alert">{exportError}</div>
      ) : null}

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_withdrawal_list_title')}</h3>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '16px 20px 16px', marginTop: 4 }}>
          <input
            className="form-input"
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="ค้นหาเลขที่ / สถานะ / หมายเหตุ..."
            style={{ flex: '1 1 200px', minWidth: 180 }}
            type="text"
            value={searchText}
          />
          {isRequestProxy && (
            <select className="form-input" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
              style={{ flex: '1 1 160px', minWidth: 160 }}>
              <option value="">-- ลูกค้าทุกราย --</option>
              {Object.entries(customerNames).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          <input className="form-input" type="date" value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            style={{ flex: '1 1 140px', minWidth: 140 }} title="วันที่แจ้งเบิก (ตั้งแต่)" />
          <input className="form-input" type="date" value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            style={{ flex: '1 1 140px', minWidth: 140 }} title="วันที่แจ้งเบิก (ถึง)" />
          {(searchText || filterCustomer || filterDateFrom || filterDateTo) && (
            <button type="button" className="btn"
              onClick={() => { setSearchText(''); setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              style={{ background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}>
              ล้างตัวกรอง
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline"
            data-testid="customer-withdrawal-export-excel"
            disabled={exporting || filteredData.length === 0}
            onClick={() => handleExportExcel(selectedRequestRows.length > 0 ? selectedRequestRows : filteredData)}
            title="ดาวน์โหลดรายละเอียดสินค้าแต่ละรายการของเอกสารที่เลือก (หรือทุกใบที่กรองอยู่ถ้าไม่ได้เลือก) เป็น Excel"
          >
            {exporting ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด Excel'}
          </button>
        </div>
        {selectedRequestIds.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid var(--tgd-border)' }}>
            <span>{selectedRequestIds.size} รายการที่เลือก</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedRequestIds(new Set())}>ยกเลิกการเลือก</button>
          </div>
        )}
        {(profileLoading || state.loading) ? <LoadingState message={t('customer_portal_loading')} /> : null}
        <div className="responsive-table list-table-view">
          <table className="data-table sticky-header-table" data-testid="customer-withdrawal-list-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="เลือกทั้งหมด"
                    checked={filteredData.length > 0 && filteredData.every((r) => selectedRequestIds.has(r.id))}
                    onChange={() => toggleSelectAllRequests(filteredData)} />
                </th>
                <th onClick={() => requestSort('request_no')} style={{ cursor: 'pointer' }}>{t('customer_col_request_no')} {getSortIndicator('request_no')}</th>
                {isRequestProxy ? <th onClick={() => requestSort('customer_id')} style={{ cursor: 'pointer' }}>{t('customer_col_customer_name')} {getSortIndicator('customer_id')}</th> : null}
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>{t('customer_col_status')} {getSortIndicator('status')}</th>
                <th>{t('customer_field_requested_dispatch_date')}</th>
                <th>{t('customer_field_delivery_type')}</th>
                <th>{t('customer_field_pickup_contact')}</th>
                <th onClick={() => requestSort('note')} style={{ cursor: 'pointer', maxWidth: 140 }}>{t('customer_col_note')} {getSortIndicator('note')}</th>
                <th onClick={() => requestSort('updated_at')} style={{ cursor: 'pointer' }}>{t('customer_history_latest_action')} {getSortIndicator('updated_at')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length ? filteredData.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input type="checkbox" aria-label={`เลือก ${row.withdrawal_no}`}
                      checked={selectedRequestIds.has(row.id)}
                      onChange={() => toggleRequestSelected(row.id)} />
                  </td>
                  <td>{row.withdrawal_no}</td>
                  {isRequestProxy ? <td>{customerNames[row.customer_id] ?? row.customer_id ?? '-'}</td> : null}
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getWithdrawalStatusLabel(row.status, t)}
                    </span>
                  </td>
                  <td>{formatDocumentDate(row.requested_dispatch_date, { dateOnly: true })}</td>
                  <td>{row.delivery_type ?? '-'}</td>
                  <td>{row.pickup_contact ?? '-'}</td>
                  <td style={{ maxWidth: 140 }}>
                    {row.note ? (
                      row.note.length > 24 ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }} title={row.note}>
                            {row.note}
                          </span>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openDetail(row)}
                            style={{ flexShrink: 0, padding: '2px 8px', fontSize: 11 }}
                            type="button"
                          >
                            ดูรายละเอียด
                          </button>
                        </span>
                      ) : row.note
                    ) : '-'}
                  </td>
                  <td>
                    <small>{formatDocumentDate(row.last_action_at)}</small>
                  </td>
                  <td>
                    <div className="action-row" style={{ flexWrap: 'wrap' }}>
                      {renderRowActions(row)}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={columnCount}>{t('customer_withdrawal_list_empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="list-card-view">
          {filteredData.length ? filteredData.map((row) => (
            <div className="list-card" key={row.id}>
              <div className="list-card-header">
                <input type="checkbox" aria-label={`เลือก ${row.withdrawal_no}`}
                  checked={selectedRequestIds.has(row.id)}
                  onChange={() => toggleRequestSelected(row.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{row.withdrawal_no}</div>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {getWithdrawalStatusLabel(row.status, t)}
                  </span>
                </div>
              </div>
              <div className="list-card-fields">
                {isRequestProxy ? <div>{t('customer_col_customer_name')}: {customerNames[row.customer_id] ?? row.customer_id ?? '-'}</div> : null}
                <div>{t('customer_field_requested_dispatch_date')}: {formatDocumentDate(row.requested_dispatch_date, { dateOnly: true })}</div>
                <div>{t('customer_field_delivery_type')}: {row.delivery_type ?? '-'}</div>
                <div>{t('customer_field_pickup_contact')}: {row.pickup_contact ?? '-'}</div>
                {row.note ? <div>{t('customer_col_note')}: {row.note}</div> : null}
                <div>{t('customer_history_latest_action')}: {formatDocumentDate(row.last_action_at)}</div>
              </div>
              <div className="list-card-actions">
                {renderRowActions(row)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--tgd-muted-text)' }}>{t('customer_withdrawal_list_empty')}</div>
          )}
        </div>
      </div>

      {detailRow ? (
        <Modal
          isOpen
          onClose={() => setDetailRow(null)}
          size="lg"
          title={detailRow.withdrawal_no ?? t('customer_withdrawal_detail_title')}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              {(detailRow.status === 'DRAFT' || detailRow.status === 'WITHDRAWAL_DRAFT' || detailRow.status === 'DEPOSIT_DRAFT') && canWriteCustomerRequests && (
                <Link
                  className="btn btn-primary"
                  data-testid={`customer-withdrawal-edit-${detailRow.id}`}
                  to={`/customer/withdrawal-request/new?editId=${detailRow.id}`}
                >
                  {t('edit') || 'แก้ไข'}
                </Link>
              )}
              <ReportPrintActions
                disabled={!detailRow}
                orientation="landscape"
                renderReport={(reportLanguage) => (
                  <CustomerWithdrawalRequestPrintDocument
                    branding={branding}
                    header={detailRow}
                    language={reportLanguage}
                    lines={detailLines}
                  />
                )}
                title={detailRow.withdrawal_no}
              />
              <button className="btn btn-secondary" onClick={() => setDetailRow(null)} type="button">
                {t('close') || 'ปิด'}
              </button>
            </div>
          }
        >
          <div className="form-grid customer-request-detail-meta" style={{ marginBottom: 16 }}>
            <div>
              <div className="form-label">{t('customer_col_customer_name')}</div>
              <div>{customerNames[detailRow.customer_id] ?? detailRow.customer_id ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_col_status')}</div>
              <span className={`status-badge status-badge--${getCustomerRequestStatusClass(detailRow.status)}`}>
                {getWithdrawalStatusLabel(detailRow.status, t)}
              </span>
            </div>
            <div>
              <div className="form-label">{t('customer_field_requested_dispatch_date')}</div>
              <div>{formatDocumentDate(detailRow.requested_dispatch_date, { dateOnly: true })}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_field_delivery_type')}</div>
              <div>{detailRow.delivery_type ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_field_pickup_contact')}</div>
              <div>{detailRow.pickup_contact ?? '-'}</div>
            </div>
            <div>
              <div className="form-label">{t('customer_col_note')}</div>
              <div>{detailRow.note || '-'}</div>
            </div>
          </div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('customer_withdrawal_lines_title')}</h4>
          {detailLinesLoading ? <LoadingState message={t('customer_portal_loading')} /> : (
            <CustomerWithdrawalRequestLinesDisplay lines={detailLines} />
          )}
        </Modal>
      ) : null}
    </section>
  );
}

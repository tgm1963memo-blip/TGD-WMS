import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { listCustomerDepositRequests, listDepositLineDetailsForDocs, cancelCustomerDepositRequest, recallCustomerDepositRequest } from '../../services/customerDepositRequestService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { buildCustomerRequestCopyPath } from '../../utils/customerRequestCopyUtils.js';
import { getDepositRecallEligibility } from '../../utils/customerRequestCancelUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { downloadExcelRows } from '../../utils/excelFileUtils.js';

export function CustomerDepositRequestListPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests, isRequestProxy, role, loading: profileLoading } = useCustomerPortalProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [customerNames, setCustomerNames] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [recallingId, setRecallingId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedRequestIds, setSelectedRequestIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const isMountedRef = useRef(true);
  const { sortedData, requestSort, getSortIndicator } = useTableSort(state.rows);

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

    listCustomerDepositRequests(filters).then((result) => {
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
  }, [customerId, profileLoading, isRequestProxy]);

  const columnCount = (isRequestProxy ? 9 : 8) + 1;
  const q = searchText.trim().toLowerCase();
  const filteredData = sortedData.filter((row) => {
    if (q) {
      const customerName = (customerNames[row.customer_id] ?? '').toLowerCase();
      const textMatch = (row.request_no ?? '').toLowerCase().includes(q) ||
        (row.status ?? '').toLowerCase().includes(q) ||
        (row.note ?? '').toLowerCase().includes(q) ||
        customerName.includes(q);
      if (!textMatch) return false;
    }
    if (filterCustomer && row.customer_id !== filterCustomer) return false;
    const date = row.expected_arrival_date ?? '';
    if (filterDateFrom && date < filterDateFrom) return false;
    if (filterDateTo && date > filterDateTo) return false;
    return true;
  });
  const selectedRequestRows = filteredData.filter((r) => selectedRequestIds.has(r.id));

  const DELETABLE_STATUSES = new Set(['DRAFT', 'WITHDRAWAL_DRAFT', 'DEPOSIT_DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING']);

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
  // CustomerDepositNotificationsSection's bulk export. Not restricted to any
  // status, since a customer may want line-item detail for a request
  // regardless of what stage it's at. Lines for every requested document are
  // fetched in one .in() query (listDepositLineDetailsForDocs) instead of one
  // round-trip per document -- a per-document fetch loop stalled the browser
  // once a filtered list ran into the hundreds (confirmed via load test on
  // the equivalent admin export).
  async function handleExportExcel(rowsToExport) {
    if (!rowsToExport.length) return;
    setExporting(true);
    setExportError('');
    const linesResult = await listDepositLineDetailsForDocs(rowsToExport.map((r) => r.id));
    if (!isMountedRef.current) return;
    if (linesResult.error) {
      setExportError(linesResult.error.message ?? 'โหลดรายการไม่สำเร็จ');
      setExporting(false);
      return;
    }
    const linesByRequestId = new Map();
    (linesResult.data ?? []).forEach((line) => {
      const key = line.deposit_request_id;
      if (!linesByRequestId.has(key)) linesByRequestId.set(key, []);
      linesByRequestId.get(key).push(line);
    });

    const exportRows = rowsToExport.flatMap((request) => {
      const lines = linesByRequestId.get(request.id) ?? [];
      const requestFields = {
        เลขที่คำขอ: request.request_no ?? '',
        ลูกค้า: request.customer?.customer_name || request.customer?.name || customerNames[request.customer_id] || request.customer_id || '',
        สถานะ: getDepositStatusLabel(request.status, t),
        วันที่แจ้งฝาก: formatDocumentDate(request.expected_arrival_date, { dateOnly: true }),
        ผู้ติดต่อ: request.contact_name ?? '',
        เบอร์โทร: request.contact_phone ?? '',
        หมายเหตุคำขอ: request.note ?? '',
      };
      if (lines.length === 0) {
        return [{ ...requestFields, รหัสสินค้า: '', ชื่อสินค้า: '', Lot: '', รหัสติดตาม: '', จำนวนกล่องที่แจ้ง: '', น้ำหนักที่แจ้ง: '', จำนวนกล่องจริง: '', น้ำหนักจริง: '', อุณหภูมิ: '', หมายเหตุรายการ: '' }];
      }
      return lines.map((line) => ({
        ...requestFields,
        รหัสสินค้า: line.customer_product_code ?? '',
        ชื่อสินค้า: line.product_name ?? '',
        Lot: line.lot_no ?? '',
        รหัสติดตาม: line.tracking_code ?? '',
        จำนวนกล่องที่แจ้ง: line.expected_boxes ?? '',
        น้ำหนักที่แจ้ง: line.expected_weight ?? '',
        จำนวนกล่องจริง: line.actual_boxes ?? '',
        น้ำหนักจริง: line.actual_weight ?? '',
        อุณหภูมิ: line.temperature_type ?? '',
        หมายเหตุรายการ: line.note ?? '',
      }));
    });

    downloadExcelRows(
      exportRows,
      ['เลขที่คำขอ', 'ลูกค้า', 'สถานะ', 'วันที่แจ้งฝาก', 'ผู้ติดต่อ', 'เบอร์โทร', 'หมายเหตุคำขอ', 'รหัสสินค้า', 'ชื่อสินค้า', 'Lot', 'รหัสติดตาม', 'จำนวนกล่องที่แจ้ง', 'น้ำหนักที่แจ้ง', 'จำนวนกล่องจริง', 'น้ำหนักจริง', 'อุณหภูมิ', 'หมายเหตุรายการ'],
      `deposit-requests-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'รายการแจ้งฝาก',
      [16, 28, 16, 14, 16, 14, 20, 14, 30, 20, 14, 12, 12, 12, 12, 12, 20],
    );
    setExporting(false);
  }

  async function handleDelete(requestId) {
    setDeleting(true);
    const result = await cancelCustomerDepositRequest(requestId, 'ลบโดยผู้ใช้งาน');
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
        <Link
          className="btn btn-secondary btn-sm"
          data-testid={`customer-deposit-view-${row.id}`}
          to={isRequestProxy && row.status !== 'DRAFT'
            ? `/customer/admin/deposit-review/${row.id}`
            : `/customer/deposit-request/${row.id}`}
        >
          {t('customer_request_view_button')}
        </Link>
        {(row.status === 'DRAFT' || row.status === 'WITHDRAWAL_DRAFT' || row.status === 'DEPOSIT_DRAFT') && canWriteCustomerRequests ? (
          <Link
            className="btn btn-primary btn-sm"
            data-testid={`customer-deposit-edit-${row.id}`}
            to={`/customer/deposit-request/new?editId=${row.id}`}
          >
            {t('edit') || 'แก้ไข'}
          </Link>
        ) : null}
        {canWriteCustomerRequests ? (
          <Link
            className="btn btn-secondary btn-sm"
            data-testid={`customer-deposit-copy-${row.id}`}
            to={buildCustomerRequestCopyPath('/customer/deposit-request/new', row.id)}
          >
            {t('customer_request_copy_button')}
          </Link>
        ) : null}
        {canWriteCustomerRequests && getDepositRecallEligibility(row, role).canRecall ? (
          <button
            className="btn btn-secondary btn-sm"
            data-testid={`customer-deposit-recall-${row.id}`}
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

  async function handleRecall(requestId) {
    if (!window.confirm('ต้องการเรียกเอกสารกลับมาแก้ไขใช่หรือไม่?\nสถานะเอกสารจะกลับเป็น "ร่าง" และหลุดออกจากคิวตรวจสอบของเจ้าหน้าที่จนกว่าจะส่งใหม่')) return;
    setRecallingId(requestId);
    const result = await recallCustomerDepositRequest(requestId);
    setRecallingId(null);
    if (result.error) {
      setState((current) => ({ ...current, error: result.error }));
      return;
    }
    setState((current) => ({
      ...current,
      rows: current.rows.map((r) => r.id === requestId ? { ...r, status: 'DRAFT' } : r),
    }));
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-request-page">
      <PageHeader
        title={t('customer_deposit_title')}
        description={isRequestProxy ? t('customer_deposit_list_proxy_description') : t('customer_deposit_list_description')}
        actions={canWriteCustomerRequests ? (
          <Link className="btn btn-primary" data-testid="customer-deposit-create-button" to="/customer/deposit-request/new">
            {t('customer_deposit_create_button')}
          </Link>
        ) : null}
      />
      <CustomerPortalLiveBanner />

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
          <h3>{t('customer_deposit_list_title')}</h3>
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
            style={{ flex: '1 1 140px', minWidth: 140 }} title="วันที่แจ้งฝาก (ตั้งแต่)" />
          <input className="form-input" type="date" value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            style={{ flex: '1 1 140px', minWidth: 140 }} title="วันที่แจ้งฝาก (ถึง)" />
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
            data-testid="customer-deposit-export-excel"
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
          <table className="data-table sticky-header-table" data-testid="customer-deposit-list-table">
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
                <th onClick={() => requestSort('expected_arrival_date')} style={{ cursor: 'pointer' }}>{t('customer_field_expected_arrival_date')} {getSortIndicator('expected_arrival_date')}</th>
                <th onClick={() => requestSort('contact_name')} style={{ cursor: 'pointer' }}>{t('customer_field_contact_name')} {getSortIndicator('contact_name')}</th>
                <th onClick={() => requestSort('contact_phone')} style={{ cursor: 'pointer' }}>{t('customer_field_contact_phone')} {getSortIndicator('contact_phone')}</th>
                <th onClick={() => requestSort('note')} style={{ cursor: 'pointer' }}>{t('customer_col_note')} {getSortIndicator('note')}</th>
                <th onClick={() => requestSort('updated_at')} style={{ cursor: 'pointer' }}>{t('customer_history_latest_action')} {getSortIndicator('updated_at')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length ? filteredData.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input type="checkbox" aria-label={`เลือก ${row.request_no}`}
                      checked={selectedRequestIds.has(row.id)}
                      onChange={() => toggleRequestSelected(row.id)} />
                  </td>
                  <td>{row.request_no}</td>
                  {isRequestProxy ? <td>{customerNames[row.customer_id] ?? row.customer_id ?? '-'}</td> : null}
                  <td>
                    <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                      {getDepositStatusLabel(row.status, t)}
                    </span>
                    {(row.status === 'RECEIVED_CONFIRMED' || row.status === 'CUSTOMER_NOTIFIED' || row.status === 'CLOSED') && !row.has_receipt_variance ? (
                      <div style={{ fontSize: 11, color: 'var(--tgd-success, #16a34a)', marginTop: 3 }}>&#10003; ได้รับสินค้าครบทุกจำนวน</div>
                    ) : null}
                    {(row.status === 'RECEIVED_CONFIRMED' || row.status === 'CUSTOMER_NOTIFIED' || row.status === 'CLOSED') && row.has_receipt_variance ? (
                      <div style={{ fontSize: 11, color: 'var(--tgd-warning, #d97706)', marginTop: 3 }}>&#9888; รับสินค้าครบแต่จำนวนไม่ตรง</div>
                    ) : null}
                    {row.status === 'RECEIVING_VARIANCE' || row.status === 'COUNT_VARIANCE_REVIEW' ? (
                      <div style={{ fontSize: 11, color: 'var(--tgd-warning, #d97706)', marginTop: 3 }}>&#9888; ได้รับสินค้าไม่ครบทุกรายการ</div>
                    ) : null}
                  </td>
                  <td>{formatDocumentDate(row.expected_arrival_date, { dateOnly: true })}</td>
                  <td>{row.contact_name ?? '-'}</td>
                  <td>{row.contact_phone ?? '-'}</td>
                  <td>{row.note || '-'}</td>
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
                  <td colSpan={columnCount}>{t('customer_deposit_list_empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="list-card-view">
          {filteredData.length ? filteredData.map((row) => (
            <div className="list-card" key={row.id}>
              <div className="list-card-header">
                <input type="checkbox" aria-label={`เลือก ${row.request_no}`}
                  checked={selectedRequestIds.has(row.id)}
                  onChange={() => toggleRequestSelected(row.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{row.request_no}</div>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {getDepositStatusLabel(row.status, t)}
                  </span>
                </div>
              </div>
              <div className="list-card-fields">
                {isRequestProxy ? <div>{t('customer_col_customer_name')}: {customerNames[row.customer_id] ?? row.customer_id ?? '-'}</div> : null}
                <div>{t('customer_field_expected_arrival_date')}: {formatDocumentDate(row.expected_arrival_date, { dateOnly: true })}</div>
                <div>{t('customer_field_contact_name')}: {row.contact_name ?? '-'}</div>
                <div>{t('customer_field_contact_phone')}: {row.contact_phone ?? '-'}</div>
                {row.note ? <div>{t('customer_col_note')}: {row.note}</div> : null}
                <div>{t('customer_history_latest_action')}: {formatDocumentDate(row.last_action_at)}</div>
              </div>
              <div className="list-card-actions">
                {renderRowActions(row)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--tgd-muted-text)' }}>{t('customer_deposit_list_empty')}</div>
          )}
        </div>
        {filteredData.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--tgd-muted-text)', padding: '8px 16px' }}>
            ทั้งหมด {filteredData.length} รายการ
          </p>
        )}
      </div>
    </section>
  );
}

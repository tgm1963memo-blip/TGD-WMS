import { useEffect, useRef, useState } from 'react';
import { LoadingState } from '../ui/LoadingState.jsx';
import { listCustomerDepositRequests, listCustomerDepositRequestLines, listDepositLineDetailsForDocs } from '../../services/customerDepositRequestService.js';
import { getCustomerRequestStatusClass } from './customerRequestStatus.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { CustomerDepositDetailModal } from './CustomerDepositDetailModal.jsx';
import { CustomerDepositStaffWorkOrderPrint } from './CustomerDepositStaffWorkOrderPrint.jsx';
import { ReportPrintActions } from '../reports/ReportPrintActions.jsx';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { mergeDepositRequestsForPrint } from '../../utils/mergeRequestLinesForPrint.js';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';
import { downloadExcelRows } from '../../utils/excelFileUtils.js';

const WAREHOUSE_DEPOSIT_STATUSES = [
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_RECEIVING',
  'PALLETIZING',
  'COUNT_VARIANCE_REVIEW',
  'ADMIN_RECOUNT_REQUESTED',
  'RECEIVED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
];

// Requests can only be combined into one printed work order while their
// work order is still active/not yet confirmed — mirrors the same status
// set used for bulk-print eligibility on the admin deposit review page.
const BULK_PRINT_ELIGIBLE_STATUSES = ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED'];

export function CustomerDepositNotificationsSection({ testId = 'receiving-customer-deposit-section' }) {
  const t = useTranslation();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [filterText, setFilterText] = useState('');
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState(() => new Set());
  const [mergedPrint, setMergedPrint] = useState(null);
  const [combining, setCombining] = useState(false);
  const [combineError, setCombineError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listCustomerDepositRequests({ statusIn: WAREHOUSE_DEPOSIT_STATUSES }).then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => {
      active = false;
    };
  }, []);

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

  async function handleCombineSelected(selectedRequestRows) {
    if (selectedRequestRows.length < 2) return;
    setCombining(true);
    setCombineError('');
    const results = await Promise.all(selectedRequestRows.map((r) => listCustomerDepositRequestLines(r.id)));
    if (!isMountedRef.current) return;
    const failed = results.find((r) => r.error);
    if (failed) {
      setCombineError(failed.error.message ?? 'โหลดรายการไม่สำเร็จ');
      setCombining(false);
      return;
    }
    // A request that legitimately contributes 0 lines (no query error, just
    // an empty array) would otherwise merge silently — the combined header
    // would still claim "รวมจากเอกสาร N ใบ" while the line table undercounts
    // by whichever document that was, with nothing telling staff why.
    const emptyIndex = results.findIndex((r) => (r.data ?? []).length === 0);
    if (emptyIndex !== -1) {
      const emptyRequest = selectedRequestRows[emptyIndex];
      setCombineError(`เอกสาร ${emptyRequest.request_no ?? emptyRequest.id} ไม่มีรายการสินค้า — กรุณาเอาออกจากการเลือกก่อนรวม`);
      setCombining(false);
      return;
    }
    const entries = selectedRequestRows.map((r, i) => ({
      header: {
        ...r,
        customer_name: r.customer?.customer_name || r.customer?.name || null,
        customer_address: r.customer?.address ?? null,
        contact_fax: r.customer?.fax ?? null,
      },
      lines: results[i].data ?? [],
    }));
    setMergedPrint(mergeDepositRequestsForPrint(entries));
    setCombining(false);
  }

  // Exports whichever requests are currently checked, or every row the
  // active filters currently show when nothing's checked — unlike the
  // "รวมเป็นใบงานเดียว" bulk-print selection above, this isn't restricted to
  // BULK_PRINT_ELIGIBLE_STATUSES, since staff need line-item detail for a
  // request regardless of what stage it's at (including ones already fully
  // received, which the print-merge flow deliberately excludes). Lines for
  // every requested document are fetched in one .in() query
  // (listDepositLineDetailsForDocs) instead of one round-trip per document —
  // the equivalent per-document fetch on the withdrawal-review export hit a
  // filtered list of 529 requests in production and stalled the browser even
  // with bounded concurrency (confirmed via load test).
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
        ลูกค้า: request.customer?.customer_name || request.customer?.name || request.customer_id || '',
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

  if (state.loading) {
    return <LoadingState message={t('customer_portal_loading')} />;
  }

  const customerOptions = [...new Map(
    state.rows
      .map((r) => ({ id: r.customer_id, name: r.customer?.customer_name || r.customer?.name || r.customer_id }))
      .filter((c) => c.id)
      .map((c) => [c.id, c])
  ).values()];

  const filteredRows = state.rows.filter((row) => {
    const text = filterText.toLowerCase();
    const matchText = !text ||
      (row.request_no ?? '').toLowerCase().includes(text) ||
      (row.contact_name ?? '').toLowerCase().includes(text);
    const matchStatus = filterStatuses.length === 0 || filterStatuses.includes(row.status);
    const matchCustomer = !filterCustomer || row.customer_id === filterCustomer;
    const arrivalDate = row.expected_arrival_date ?? '';
    const matchDateFrom = !filterDateFrom || arrivalDate >= filterDateFrom;
    const matchDateTo = !filterDateTo || arrivalDate <= filterDateTo;
    return matchText && matchStatus && matchCustomer && matchDateFrom && matchDateTo;
  });

  const bulkEligibleRows = filteredRows.filter((r) => BULK_PRINT_ELIGIBLE_STATUSES.includes(r.status));
  const selectedRequestRows = filteredRows
    .filter((r) => selectedRequestIds.has(r.id))
    .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
  const hasCustomerMismatch = new Set(selectedRequestRows.map((r) => r.customer_id)).size > 1;
  const branding = getDocumentBrandingConfig();

  return (
    <section className="table-card customer-deposit-notifications-section" data-testid={testId}>
      <div className="table-card-header">
        <h3>{t('receiving_customer_deposit_section_title')}</h3>
        <span className="form-helper">{t('receiving_customer_deposit_section_hint')}</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '16px 20px' }}>
        <label className="form-label" style={{ margin: 0, flex: '1 1 200px', maxWidth: 300 }}>
          {'ค้นหา'}
          <input
            className="form-control"
            type="search"
            placeholder="เลขที่คำขอ / ชื่อผู้ติดต่อ"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 100%' }}>
          <span className="form-label" style={{ margin: 0 }}>
            {'สถานะ (เลือกได้หลายรายการ — ใช้กรองทั้งตารางและตอนดาวน์โหลด Excel)'}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WAREHOUSE_DEPOSIT_STATUSES.map((status) => {
              const active = filterStatuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  data-testid={`deposit-notifications-status-chip-${status}`}
                  onClick={() => setFilterStatuses((prev) => (
                    prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                  ))}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: active ? '1px solid #2d9348' : '1px solid var(--tgd-border)',
                    background: active ? '#2d9348' : '#fff',
                    color: active ? '#fff' : '#334155',
                  }}
                >
                  {getDepositStatusLabel(status, t)}
                </button>
              );
            })}
          </div>
        </div>
        <label className="form-label" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}>
          {'วันที่แจ้งฝาก (ตั้งแต่)'}
          <input
            className="form-control"
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </label>
        <label className="form-label" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}>
          {'วันที่แจ้งฝาก (ถึง)'}
          <input
            className="form-control"
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </label>
        {(filterText || filterStatuses.length > 0 || filterCustomer || filterDateFrom || filterDateTo) ? (
          <button
            type="button"
            className="btn"
            onClick={() => { setFilterText(''); setFilterStatuses([]); setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            style={{ alignSelf: 'flex-end', background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}
          >
            {'ล้างตัวกรอง'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-outline"
          data-testid="receiving-customer-deposit-export-excel"
          disabled={exporting || filteredRows.length === 0}
          onClick={() => handleExportExcel(selectedRequestRows.length > 0 ? selectedRequestRows : filteredRows)}
          style={{ alignSelf: 'flex-end' }}
          title="ดาวน์โหลดรายละเอียดสินค้าแต่ละรายการของทุกคำขอที่กรองอยู่ตอนนี้เป็น Excel"
        >
          {exporting ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด Excel'}
        </button>
      </div>

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

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
            title={`${mergedPrint.header.request_no} — ${t('receiving_review_deposit_button')}`}
            renderReport={(language) => (
              <CustomerDepositStaffWorkOrderPrint
                branding={branding}
                header={mergedPrint.header}
                language={language}
                lines={mergedPrint.lines}
              />
            )}
          />
        </div>
      )}

      <div className="responsive-table">
        <table className="data-table" data-testid="receiving-customer-deposit-table">
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
              <th>{t('customer_col_request_no')}</th>
              <th>{t('customer_col_customer_name') ?? 'ลูกค้า'}</th>
              <th>{t('customer_col_status')}</th>
              <th>{t('customer_field_expected_arrival_date')}</th>
              <th>{t('customer_field_contact_name')}</th>
              <th>{t('customer_field_contact_phone')}</th>
              <th>{t('customer_col_note')}</th>
              <th>{t('catalog_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`เลือก ${row.request_no}`}
                    disabled={!BULK_PRINT_ELIGIBLE_STATUSES.includes(row.status)}
                    checked={selectedRequestIds.has(row.id)}
                    onChange={() => toggleRequestSelected(row.id)}
                  />
                </td>
                <td>
                  <a className="table-action-link" href={`/customer/deposit-request/${row.id}`} onClick={(e) => {
                    e.preventDefault();
                    setDetailId(row.id);
                  }}>{row.request_no}</a>
                </td>
                <td>{row.customer?.customer_name || row.customer?.name || row.customer_id || '-'}</td>
                <td>
                  <span className={`status-badge status-badge--${getCustomerRequestStatusClass(row.status)}`}>
                    {getDepositStatusLabel(row.status, t)}
                  </span>
                </td>
                <td>{formatDocumentDate(row.expected_arrival_date, { dateOnly: true })}</td>
                <td>{row.contact_name ?? '-'}</td>
                <td>{row.contact_phone ?? '-'}</td>
                <td>{row.note || '-'}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    data-testid={`receiving-review-deposit-${row.id}`}
                    type="button"
                    onClick={() => setDetailId(row.id)}
                  >
                    {t('receiving_review_deposit_button')}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9}>
                  {filterText || filterStatuses.length > 0
                    ? 'ไม่พบรายการที่ตรงกับเงื่อนไข'
                    : t('receiving_customer_deposit_empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerDepositDetailModal
        requestId={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onStatusChange={(id, newStatus) => {
          setState((prev) => ({
            ...prev,
            rows: prev.rows.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
          }));
        }}
      />
    </section>
  );
}

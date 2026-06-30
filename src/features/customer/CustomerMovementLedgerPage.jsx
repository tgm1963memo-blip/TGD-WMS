import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { MovementLedgerTable } from '../../components/reports/MovementLedgerTable.jsx';
import { InventoryMovementReportTemplate } from '../../components/reports/InventoryMovementReportTemplate.jsx';
import { ReportPrintActions } from '../../components/reports/ReportPrintActions.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import {
  getMovementLedgerRows,
  getConfirmedDepositReceiptRows,
  getConfirmedWithdrawalRows,
  summarizeMovements,
} from '../../services/movementLedgerReportService.js';
import { mapMovementLedgerToInventoryReportData } from '../../services/operationalReportMapper.js';
import { getDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getCustomers } from '../../services/masterDataService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useAuth } from '../auth/AuthContext.jsx';

const INBOUND_SKIP = new Set(['RECEIVE', 'RECEIVE_CONFIRM', 'RECEIVE_PENDING', 'INBOUND', 'RETURN', 'ADJUSTMENT_IN']);

const initialState = { rows: [], summary: null, loading: false, error: null };

export function CustomerMovementLedgerPage() {
  const { customerId, loading: profileLoading } = useCustomerPortalProfile();
  const { session } = useAuth();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [state, setState] = useState(initialState);
  const [searched, setSearched] = useState(false);
  const [customerDetails, setCustomerDetails] = useState(null);

  const branding = getDocumentBrandingConfig();
  const printedBy = session?.user?.email ?? null;

  useEffect(() => {
    if (!customerId) return;
    getCustomers().then(({ data }) => {
      const cust = (data ?? []).find((c) => c.id === customerId);
      setCustomerDetails(cust ?? null);
    });
  }, [customerId]);

  function handleSearch(e) {
    e.preventDefault();
    if (!customerId) return;
    setSearched(true);
  }

  useEffect(() => {
    if (!searched || profileLoading || !customerId) return;

    let isMounted = true;
    setState((cur) => ({ ...cur, loading: true, error: null }));

    const filters = {
      customerId: customerId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };

    Promise.all([
      getMovementLedgerRows(filters),
      getConfirmedDepositReceiptRows(filters),
      getConfirmedWithdrawalRows(filters),
    ]).then(([result, depositResult, withdrawalResult]) => {
      if (!isMounted) return;

      const outboundRows = (result.data ?? []).filter((r) => {
        const movType = String(r.movement_type_raw || '').toUpperCase();
        return !movType.includes('DRAFT') && !INBOUND_SKIP.has(movType);
      });

      const rows = [
        ...(depositResult.data ?? []),
        ...(withdrawalResult.data ?? []),
        ...outboundRows,
      ].sort((a, b) => {
        const aTime = new Date(a.movement_date ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.movement_date ?? b.created_at ?? 0).getTime();
        if (aTime !== bTime) return aTime - bTime;
        // Same date: inbound (RECEIVE_CONFIRM) before outbound (DISPATCH)
        const aOut = (a.movement_type === 'DISPATCH' || a.movement_type_canonical === 'DISPATCH') ? 1 : 0;
        const bOut = (b.movement_type === 'DISPATCH' || b.movement_type_canonical === 'DISPATCH') ? 1 : 0;
        return aOut - bOut;
      });

      setState({
        rows,
        summary: summarizeMovements(rows),
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => { isMounted = false; };
  }, [searched, customerId, profileLoading, dateFrom, dateTo]);

  // Product options derived from loaded rows
  const productOptions = searched && state.rows.length > 0
    ? [...new Map(
        state.rows
          .filter((r) => r.product_name || r.customer_product_code)
          .map((r) => [
            r.product_id ?? r.customer_product_code,
            { id: r.product_id ?? r.customer_product_code, label: r.product_name ?? r.customer_product_code },
          ])
      ).values()].sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
    : [];

  // Apply client-side product filter
  const filteredRows = productFilter
    ? state.rows.filter((r) => (r.product_id ?? r.customer_product_code) === productFilter)
    : state.rows;

  const filteredSummary = summarizeMovements(filteredRows);
  const customerLabel = customerDetails?.customer_name ?? customerDetails?.name ?? customerId ?? '-';

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-movement-ledger-page">
      <PageHeader
        title="รายงานการเคลื่อนไหวสินค้า"
        description="ประวัติการรับเข้า-เบิกออกสินค้าของบริษัทคุณ"
      />
      <CustomerPortalLiveBanner />

      {!customerId && !profileLoading ? (
        <div className="banner banner-warning" role="status">ไม่พบขอบเขตลูกค้า กรุณาติดต่อผู้ดูแลระบบ</div>
      ) : null}

      {/* ── Filter form ── */}
      <form className="table-card no-print" style={{ padding: '20px 24px' }} onSubmit={handleSearch}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>วันที่เริ่มต้น</label>
            <input
              className="form-input"
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setSearched(false); }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>วันที่สิ้นสุด</label>
            <input
              className="form-input"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setSearched(false); }}
            />
          </div>
          {productOptions.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>สินค้า</label>
              <select
                className="form-input"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                <option value="">ทุกสินค้า</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={!customerId || profileLoading}>
            ดูรายงาน
          </button>
          {(dateFrom || dateTo || productFilter) && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); setProductFilter(''); setSearched(false); }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </form>

      {state.loading ? <LoadingState message="กำลังโหลดข้อมูล..." /> : null}

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? 'เกิดข้อผิดพลาด'}</div>
      ) : null}

      {searched && !state.loading && filteredSummary.totalMovementRows > 0 ? (
        <>
          {/* ── KPI summary ── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
            <div className="kpi-card">
              <div className="kpi-value">{filteredSummary.totalMovementRows}</div>
              <div className="kpi-label">รายการทั้งหมด</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: 'var(--tgd-success, #16a34a)' }}>+{filteredSummary.totalInboundQty}</div>
              <div className="kpi-label">รับเข้า (ลัง)</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: 'var(--tgd-danger, #dc2626)' }}>-{filteredSummary.totalOutboundQty}</div>
              <div className="kpi-label">เบิกออก (ลัง)</div>
            </div>
          </div>

          {/* ── Print action — below KPIs, above table ── */}
          <div className="no-print" style={{ marginBottom: 12 }}>
            <ReportPrintActions
              title="Entry-Delivery Inventory Report"
              disabled={false}
              orientation="landscape"
              renderReport={(reportLanguage) => (
                <InventoryMovementReportTemplate
                  branding={branding}
                  printedBy={printedBy}
                  customerDetails={customerDetails}
                  data={mapMovementLedgerToInventoryReportData({
                    rows: filteredRows,
                    filters: {
                      customer_name: customerLabel,
                      customer_address: customerDetails?.address,
                      date_from: dateFrom,
                      date_to: dateTo,
                    },
                    summary: filteredSummary,
                  })}
                  language={reportLanguage}
                />
              )}
            />
          </div>

          {/* ── Data table ── */}
          <MovementLedgerTable data={filteredRows} loading={false} error={null} />
        </>
      ) : null}

      {searched && !state.loading && state.rows.length === 0 && !state.error ? (
        <div className="banner banner-info" role="status" style={{ marginTop: 12 }}>
          ไม่พบข้อมูลการเคลื่อนไหวสินค้าในช่วงที่เลือก
        </div>
      ) : null}

      {searched && !state.loading && state.rows.length > 0 && filteredRows.length === 0 ? (
        <div className="banner banner-info" role="status" style={{ marginTop: 12 }}>
          ไม่พบรายการสำหรับสินค้าที่เลือก — ลองเลือกสินค้าอื่นหรือดูทุกสินค้า
        </div>
      ) : null}
    </section>
  );
}

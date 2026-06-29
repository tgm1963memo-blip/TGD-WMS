import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { MovementLedgerTable } from '../../components/reports/MovementLedgerTable.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import {
  getMovementLedgerRows,
  getConfirmedDepositReceiptRows,
  getConfirmedWithdrawalRows,
  summarizeMovements,
} from '../../services/movementLedgerReportService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';

const INBOUND_SKIP = new Set(['RECEIVE', 'RECEIVE_CONFIRM', 'RECEIVE_PENDING', 'INBOUND', 'RETURN', 'ADJUSTMENT_IN']);

const initialState = { rows: [], summary: null, loading: false, error: null };

function buildFilters(customerId, dateFrom, dateTo) {
  return {
    customerId: customerId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
}

export function CustomerMovementLedgerPage() {
  const { customerId, loading: profileLoading } = useCustomerPortalProfile();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [state, setState] = useState(initialState);
  const [searched, setSearched] = useState(false);

  function handleSearch(e) {
    e.preventDefault();
    if (!customerId) return;
    setSearched(true);
  }

  useEffect(() => {
    if (!searched || profileLoading || !customerId) return;

    let isMounted = true;
    setState((cur) => ({ ...cur, loading: true, error: null }));

    const filters = buildFilters(customerId, dateFrom, dateTo);

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
        return aTime - bTime;
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

      <form className="table-card" style={{ padding: '20px 24px' }} onSubmit={handleSearch}>
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
          <button className="btn btn-primary" type="submit" disabled={!customerId || profileLoading}>
            ดูรายงาน
          </button>
          {searched && state.rows.length > 0 && (
            <button
              className="btn btn-secondary no-print"
              type="button"
              onClick={() => {
                const style = document.createElement('style');
                style.textContent = '@page { size: A4 landscape; margin: 8mm; }';
                document.head.appendChild(style);
                window.print();
                document.head.removeChild(style);
              }}
            >
              พิมพ์ (แนวนอน)
            </button>
          )}
          {(dateFrom || dateTo) && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); setSearched(false); }}
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

      {searched && !state.loading && state.summary ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
          <div className="kpi-card">
            <div className="kpi-value">{state.summary.totalMovementRows}</div>
            <div className="kpi-label">รายการทั้งหมด</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: 'var(--tgd-success, #16a34a)' }}>+{state.summary.totalInboundQty}</div>
            <div className="kpi-label">รับเข้า (ลัง)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: 'var(--tgd-danger, #dc2626)' }}>-{state.summary.totalOutboundQty}</div>
            <div className="kpi-label">เบิกออก (ลัง)</div>
          </div>
        </div>
      ) : null}

      {searched && !state.loading ? (
        <MovementLedgerTable data={state.rows} loading={state.loading} error={state.error} />
      ) : null}

      {searched && !state.loading && state.rows.length === 0 && !state.error ? (
        <div className="banner banner-info" role="status" style={{ marginTop: 12 }}>
          ไม่พบข้อมูลการเคลื่อนไหวสินค้าในช่วงที่เลือก
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { AgingBucketSummary } from '../../components/reports/AgingBucketSummary.jsx';
import { ExpiryAlertTable } from '../../components/reports/ExpiryAlertTable.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { StorageAgingTable } from '../../components/reports/StorageAgingTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getCustomers } from '../../services/masterDataService.js';
import {
  getExpiryAlertRows,
  getStorageAgingRows,
  groupAgingByCustomer,
  summarizeAgingRows,
} from '../../services/storageAgingReportService.js';

const initialState = {
  rows: [],
  summary: null,
  expiryAlerts: [],
  customerSummary: [],
  loading: true,
  error: null,
};

export function StorageAgingReportPage() {
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);
  const [customerOptions, setCustomerOptions] = useState(null);

  useEffect(() => {
    getCustomers({ isActive: true }).then(({ data }) => {
      if (data) {
        setCustomerOptions(
          data.map((c) => ({ value: c.id, label: `${c.customer_code} — ${c.customer_name}`, rawName: c.customer_name }))
        );
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      getStorageAgingRows(filters),
      getExpiryAlertRows(filters),
    ]).then(([rowsResult, expiryResult]) => {
      if (!isMounted) return;

      const rows = rowsResult.data ?? [];
      const expiryAlerts = expiryResult.data ?? [];
      const error = rowsResult.error ?? expiryResult.error ?? null;
      const summary = summarizeAgingRows(rows);

      setState({
        rows,
        summary,
        expiryAlerts,
        customerSummary: groupAgingByCustomer(rows),
        loading: false,
        error,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [filters]);

  return (
    <section className="page-shell">
      <PageHeader
        title="รายงานอายุการจัดเก็บสินค้า (Storage Aging Report)"
        description="รายงานแสดงข้อมูลอายุสินค้า, วันหมดอายุ, และจำนวนวันคิดค่าฝากสำหรับลูกค้าแต่ละราย — คำนวณสดจากยอดฝากที่ยืนยันแล้วหักการเบิกที่เสร็จสมบูรณ์ ตัวเลขเดียวกับหน้ายอดคงเหลือ"
      />
      {/* Storage aging is a current-stock snapshot (getAllCustomerStockBalances
          — no date-range query at all) filtered only by customerId/productId/
          lotNo (see applyStorageAgingFilters in storageAgingReportService.js).
          Date range, ประเภทเอกสาร, Location, อุณหภูมิ, Warehouse, and Reference
          Type used to render here anyway and silently do nothing when filled
          in. */}
      <ReportFilterPanel
        onChange={setFilters}
        customerOptions={customerOptions}
        showLotNo
        showDateRange={false}
        showMovementType={false}
        showLocation={false}
        showTemperature={false}
        showWarehouse={false}
        showReferenceType={false}
      />

      <DashboardSection title="สรุปภาพรวม (Overall Summary)">
        <div className="report-summary-grid" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <ReportSummaryCard
            label="อายุจัดเก็บเฉลี่ย (วัน)"
            value={state.summary?.average_storage_age}
            testId="summary-avg-age"
          />
          <ReportSummaryCard
            label="อายุสินค้าคงเหลือเฉลี่ย (วัน)"
            value={state.summary?.average_shelf_life}
            testId="summary-avg-shelf-life"
          />
          <ReportSummaryCard
            label="หมดอายุแล้ว (รายการ)"
            value={state.summary?.expired_lots}
            testId="summary-expired"
          />
          <ReportSummaryCard
            label="ใกล้หมดอายุ (รายการ)"
            value={state.summary?.near_expiry_lots}
            testId="summary-near-expiry"
          />
          <ReportSummaryCard
            label="ไม่มีวันหมดอายุ (รายการ)"
            value={state.summary?.no_expiry_lots}
            testId="summary-no-expiry"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="รายงานอายุสินค้าจัดเก็บ (Storage Aging Table)">
        <StorageAgingTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="รายการใกล้หมดอายุ / หมดอายุ (Expiry Alert Section)">
        <ExpiryAlertTable data={state.expiryAlerts} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="สรุปตามลูกค้า">
        <AgingBucketSummary data={state.customerSummary} loading={state.loading} error={state.error} label="ลูกค้า" />
      </DashboardSection>
    </section>
  );
}

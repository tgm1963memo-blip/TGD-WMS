import { useEffect, useMemo, useState } from 'react';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { AgingBucketSummary } from '../../components/reports/AgingBucketSummary.jsx';
import { ExpiryAlertTable } from '../../components/reports/ExpiryAlertTable.jsx';
import { ReportFilterPanel } from '../../components/reports/ReportFilterPanel.jsx';
import { ReportSummaryCard } from '../../components/reports/ReportSummaryCard.jsx';
import { StorageAgingTable } from '../../components/reports/StorageAgingTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getCustomers, getProducts } from '../../services/masterDataService.js';
import {
  getExpiryAlertRows,
  getStorageAgingRows,
  groupAgingByCustomer,
  groupAgingByWarehouse,
  summarizeAgingRows,
} from '../../services/storageAgingReportService.js';

const initialState = {
  rows: [],
  summary: null,
  expiryAlerts: [],
  customerSummary: [],
  warehouseSummary: [],
  loading: true,
  error: null,
};

export function StorageAgingReportPage() {
  const [filters, setFilters] = useState({});
  const [state, setState] = useState(initialState);
  const [customerOptions, setCustomerOptions] = useState(null);

  const [productOptions, setProductOptions] = useState(null);

  useEffect(() => {
    Promise.all([
      getCustomers({ isActive: true }),
      getProducts({ isActive: true })
    ]).then(([customerResult, productResult]) => {
      if (customerResult.data) {
        setCustomerOptions(
          customerResult.data.map((c) => ({ value: c.id, label: `${c.customer_code} — ${c.customer_name}`, rawName: c.customer_name }))
        );
      }
      if (productResult.data) {
        setProductOptions(
          productResult.data.map((p) => ({ value: p.id, label: `${p.sku ?? p.id} — ${p.name}`, rawName: p.name }))
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
        warehouseSummary: groupAgingByWarehouse(rows),
        loading: false,
        error,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [filters]);

  const displayState = useMemo(() => {
    if (!customerOptions || !productOptions) {
      return state;
    }

    const cMap = Object.fromEntries(customerOptions.map((c) => [c.value, c.label]));
    const pMap = Object.fromEntries(productOptions.map((p) => [p.value, p.label]));

    const mapRow = (row) => ({
      ...row,
      customer_name: row.customer_name ?? cMap[row.customer_id] ?? row.customer_id,
      product_name: row.product_name ?? pMap[row.product_id] ?? row.product_id,
    });

    const rows = state.rows.map(mapRow);
    const expiryAlerts = state.expiryAlerts.map(mapRow);
    const wMap = Object.fromEntries(rows.map((r) => [r.warehouse_id, r.warehouse_name ?? r.warehouse_id]));

    return {
      ...state,
      rows,
      expiryAlerts,
      customerSummary: groupAgingByCustomer(rows).map((summaryRow) => ({
        ...summaryRow,
        group_id: cMap[summaryRow.group_id] ?? summaryRow.group_id,
      })),
      warehouseSummary: groupAgingByWarehouse(rows).map((summaryRow) => ({
        ...summaryRow,
        group_id: summaryRow.group_id === 'UNASSIGNED'
          ? 'ยังไม่ระบุคลัง'
          : (wMap[summaryRow.group_id] ?? summaryRow.group_id),
      })),
    };
  }, [state, customerOptions, productOptions]);

  return (
    <section className="page-shell">
      <PageHeader
        title="รายงานอายุการจัดเก็บสินค้า (Storage Aging Report)"
        description="รายงานแสดงข้อมูลอายุสินค้า, วันหมดอายุ, และจำนวนวันคิดค่าฝากสำหรับลูกค้าแต่ละราย"
      />
      <ReportFilterPanel onChange={setFilters} customerOptions={customerOptions} productOptions={productOptions} />

      <DashboardSection title="สรุปภาพรวม (Overall Summary)">
        <div className="report-summary-grid" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <ReportSummaryCard 
            label="อายุจัดเก็บเฉลี่ย (วัน)" 
            value={displayState.summary?.average_storage_age} 
            testId="summary-avg-age" 
          />
          <ReportSummaryCard 
            label="อายุสินค้าคงเหลือเฉลี่ย (วัน)" 
            value={displayState.summary?.average_shelf_life} 
            testId="summary-avg-shelf-life" 
          />
          <ReportSummaryCard 
            label="หมดอายุแล้ว (รายการ)" 
            value={displayState.summary?.expired_lots} 
            testId="summary-expired" 
          />
          <ReportSummaryCard 
            label="ใกล้หมดอายุ (รายการ)" 
            value={displayState.summary?.near_expiry_lots} 
            testId="summary-near-expiry" 
          />
          <ReportSummaryCard 
            label="ไม่มีวันหมดอายุ (รายการ)" 
            value={displayState.summary?.no_expiry_lots} 
            testId="summary-no-expiry" 
          />
        </div>
      </DashboardSection>

      <DashboardSection title="รายงานอายุสินค้าจัดเก็บ (Storage Aging Table)">
        <StorageAgingTable data={displayState.rows} loading={displayState.loading} error={displayState.error} />
      </DashboardSection>

      <DashboardSection title="รายการใกล้หมดอายุ / หมดอายุ (Expiry Alert Section)">
        <ExpiryAlertTable data={displayState.expiryAlerts} loading={displayState.loading} error={displayState.error} />
      </DashboardSection>

      <DashboardSection title="สรุปตามลูกค้า">
        <AgingBucketSummary data={displayState.customerSummary} loading={displayState.loading} error={displayState.error} label="ลูกค้า" />
      </DashboardSection>

      <DashboardSection title="สรุปตามคลังสินค้า">
        <AgingBucketSummary data={displayState.warehouseSummary} loading={displayState.loading} error={displayState.error} label="คลังสินค้า" />
      </DashboardSection>
    </section>
  );
}

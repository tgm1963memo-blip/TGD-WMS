import { useEffect, useState } from 'react';
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
  getStorageAgingSummary,
  groupAgingByCustomer,
  groupAgingByWarehouse,
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
      getStorageAgingSummary(filters),
      getExpiryAlertRows(filters),
    ]).then(([rowsResult, summaryResult, expiryResult]) => {
      if (!isMounted) return;

      let rows = rowsResult.data ?? [];
      let expiryAlerts = expiryResult.data ?? [];
      const error = rowsResult.error ?? summaryResult.error ?? expiryResult.error ?? null;

      let mappedCustomerSummary = groupAgingByCustomer(rows);
      let mappedWarehouseSummary = groupAgingByWarehouse(rows);

      if (customerOptions && productOptions) {
        const cMap = Object.fromEntries(customerOptions.map(c => [c.value, c.label]));
        const pMap = Object.fromEntries(productOptions.map(p => [p.value, p.label]));

        const mapRow = r => ({
          ...r,
          customer_name: r.customer_name ?? cMap[r.customer_id] ?? r.customer_id,
          product_name: r.product_name ?? pMap[r.product_id] ?? r.product_id,
        });

        rows = rows.map(mapRow);
        expiryAlerts = expiryAlerts.map(mapRow);

        mappedCustomerSummary = groupAgingByCustomer(rows).map(s => ({
          ...s,
          group_id: cMap[s.group_id] ?? s.group_id
        }));
        
        // Warehouse names are usually in row.warehouse_name, we can just group and pick the name from the first row or rely on row mapping if warehouse_name is present. 
        // groupAgingByWarehouse groups by warehouse_id. Let's just map group_id to warehouse_name if it exists in any row.
        const wMap = Object.fromEntries(rows.map(r => [r.warehouse_id, r.warehouse_name ?? r.warehouse_id]));
        mappedWarehouseSummary = groupAgingByWarehouse(rows).map(s => ({
          ...s,
          group_id: s.group_id === 'UNASSIGNED' ? 'ยังไม่ระบุคลัง' : (wMap[s.group_id] ?? s.group_id)
        }));
      }

      setState({
        rows,
        summary: summaryResult.data,
        expiryAlerts,
        customerSummary: mappedCustomerSummary,
        warehouseSummary: mappedWarehouseSummary,
        loading: false,
        error,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [filters, customerOptions, productOptions]);

  return (
    <section className="page-shell">
      <PageHeader
        title="รายงานอายุการจัดเก็บสินค้า (Storage Aging Report)"
        description="รายงานแสดงข้อมูลอายุสินค้า, วันหมดอายุ, และจำนวนวันคิดค่าฝากสำหรับลูกค้าแต่ละราย"
      />
      <ReportFilterPanel onChange={setFilters} customerOptions={customerOptions} productOptions={productOptions} />

      <DashboardSection title="รายงานอายุสินค้าจัดเก็บ (Storage Aging Table)">
        <StorageAgingTable data={state.rows} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="รายการใกล้หมดอายุ / หมดอายุ (Expiry Alert Section)">
        <ExpiryAlertTable data={state.expiryAlerts} loading={state.loading} error={state.error} />
      </DashboardSection>

      <DashboardSection title="สรุปตามลูกค้า">
        <AgingBucketSummary data={state.customerSummary} loading={state.loading} error={state.error} label="ลูกค้า" />
      </DashboardSection>

      <DashboardSection title="สรุปตามคลังสินค้า">
        <AgingBucketSummary data={state.warehouseSummary} loading={state.loading} error={state.error} label="คลังสินค้า" />
      </DashboardSection>
    </section>
  );
}

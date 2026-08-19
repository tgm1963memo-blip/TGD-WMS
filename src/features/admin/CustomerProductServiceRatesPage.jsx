import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ExcelImportExportToolbar } from '../../components/customer/ExcelImportExportToolbar.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { getCustomers } from '../../services/masterDataService.js';
import { listCustomerProducts, upsertCustomerProduct } from '../../services/customerProductCatalogService.js';
import {
  SERVICE_TYPES,
  UNIT_BASIS,
  TEMPERATURE_TYPES,
  listAllProductServiceRates,
  listCustomerProductsForRateImport,
  upsertProductServiceRate,
  deleteProductServiceRate,
  bulkUpsertProductServiceRates,
  listDistinctServiceTypes,
} from '../../services/productServiceRatesService.js';
import {
  buildStorageRateLookupMap,
  downloadStorageRateTemplate,
  exportStorageRatesExcel,
  parseStorageRateImportFile,
} from '../../utils/storageRateExcelUtils.js';

const ALL_ITEMS_VALUE = '__ALL_ITEMS__';
const CATEGORY_PREFIX = '__CATEGORY__:';

function isAllItemsScope(productIdValue) {
  return productIdValue === ALL_ITEMS_VALUE || productIdValue.startsWith(CATEGORY_PREFIX);
}

function categoryTemperatureOf(productIdValue) {
  return productIdValue.startsWith(CATEGORY_PREFIX) ? productIdValue.slice(CATEGORY_PREFIX.length) : '';
}

const EMPTY_FORM = {
  rateId: '',
  customerId: '',
  productId: '',
  serviceType: 'STORAGE',
  rate: '',
  unitBasis: 'PER_KG',
  currency: 'THB',
  note: '',
  periodDays: '',
  maxQuantity: '',
  minChargeAmount: '',
  contractStartDate: '',
  contractEndDate: '',
  freeDays: '',
  discountPercent: '',
  contractNote: '',
};

const SERVICE_COLORS = {
  STORAGE:      { bg: '#eff6ff', color: '#1d6fcf' },
  HANDLING_IN:  { bg: '#f0fdf4', color: '#0e7a3a' },
  HANDLING_OUT: { bg: '#fff7ed', color: '#c2570b' },
  LABEL:        { bg: '#fdf4ff', color: '#7c3aed' },
  FREEZING:     { bg: '#f0f9ff', color: '#0369a1' },
  OTHER:        { bg: '#f8fafc', color: '#475569' },
};

function ServiceBadge({ type }) {
  const st = SERVICE_TYPES.find((s) => s.value === type);
  const c = SERVICE_COLORS[type] ?? SERVICE_COLORS.OTHER;
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '3px 8px', borderRadius: 6,
      background: c.bg, color: c.color, border: `1px solid ${c.color}33`,
    }}>
      {st?.label ?? type}
    </span>
  );
}

export function CustomerProductServiceRatesPage() {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [distinctServiceTypes, setDistinctServiceTypes] = useState([]);

  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);

  const [form, setForm] = useState(null);
  const [formProducts, setFormProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [storageChargeBasis, setStorageChargeBasis] = useState('WEIGHT');
  const [basisSaving, setBasisSaving] = useState(false);

  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importErrors, setImportErrors] = useState([]);

  useEffect(() => {
    getCustomers().then((r) => setCustomers(r.data ?? []));
    listDistinctServiceTypes().then((r) => setDistinctServiceTypes(r.data ?? []));
  }, []);

  useEffect(() => {
    setProductId('');
    setProducts([]);
    if (!customerId) return;
    listCustomerProducts({ customerId }).then((r) => setProducts(r.data ?? []));
  }, [customerId]);

  useEffect(() => {
    if (!productId) {
      setStorageChargeBasis('WEIGHT');
      return;
    }
    const found = products.find((p) => p.id === productId);
    setStorageChargeBasis(found?.storage_charge_basis ?? 'WEIGHT');
  }, [productId, products]);

  async function loadRates() {
    setRatesLoading(true);
    const { data, error: rateError } = await listAllProductServiceRates({
      customerId: customerId || undefined,
      customerProductId: productId || undefined,
      serviceType: serviceTypeFilter || undefined,
      isActive: activeFilter === '' ? undefined : activeFilter === 'true',
    });
    setRates(data ?? []);
    setRatesLoading(false);
    if (rateError) setError(rateError.message ?? 'โหลดอัตราค่าบริการไม่สำเร็จ');
  }

  useEffect(() => {
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, productId, serviceTypeFilter, activeFilter]);

  async function handleBasisChange(newBasis) {
    const selectedProduct = products.find((p) => p.id === productId);
    if (!selectedProduct) return;
    setStorageChargeBasis(newBasis);
    setBasisSaving(true);
    setError('');
    const result = await upsertCustomerProduct({
      productId: selectedProduct.id,
      customerId: selectedProduct.customer_id,
      customerProductCode: selectedProduct.customer_product_code,
      productName: selectedProduct.product_name,
      internalProductCode: selectedProduct.internal_product_code ?? '',
      uom: selectedProduct.uom ?? '',
      packWeightKg: selectedProduct.pack_weight_kg ?? null,
      temperatureType: selectedProduct.temperature_type ?? 'FROZEN',
      argentType: selectedProduct.argent_type ?? 'NON_ARGENT',
      storageChargeBasis: newBasis,
      allergen: selectedProduct.allergen ?? '',
      note: selectedProduct.note ?? '',
      isActive: selectedProduct.is_active !== false,
    });
    setBasisSaving(false);
    if (result.error) {
      setError(result.error.message ?? 'บันทึกฐานคิดค่าฝากไม่สำเร็จ');
    } else {
      setSuccess('บันทึกฐานคิดค่าฝากเรียบร้อยแล้ว');
    }
  }

  function openCreate() {
    // EMPTY_FORM.serviceType defaults to STORAGE, which now requires a
    // storage-method category (see the productId <select> below) — the
    // filter bar's productId is always either empty or a real product id,
    // never a category, so it would be an invalid pre-fill here.
    setForm({ ...EMPTY_FORM, customerId, productId: categoryTemperatureOf(productId) ? productId : '' });
    setFormProducts(products);
    setError('');
    setSuccess('');
  }

  // Storage (ค่าฝากสินค้า) rates must be scoped by storage method
  // (temperature_type — CHILLED/FROZEN/FREEZE/FREEZE_FROZEN), never by an
  // individual product or an unscoped "all items" bucket: storage billing
  // is inherently about which storage method a lot sits under, not which
  // specific SKU it is. Switching a rate's service type to STORAGE clears
  // any non-category product selection so the admin is forced to pick a
  // storage method before saving.
  function handleServiceTypeChange(newServiceType) {
    setForm((f) => (
      newServiceType === 'STORAGE' && !categoryTemperatureOf(f.productId)
        ? { ...f, serviceType: newServiceType, productId: '' }
        : { ...f, serviceType: newServiceType }
    ));
  }

  function openEdit(row) {
    const productId = row.customer_product_id
      ?? (row.is_all_items
        ? (row.temperature_type ? `${CATEGORY_PREFIX}${row.temperature_type}` : ALL_ITEMS_VALUE)
        : '');
    setForm({
      rateId:      row.id,
      customerId:  row.customer_id ?? '',
      productId,
      serviceType: row.service_type,
      rate:        String(row.rate ?? ''),
      unitBasis:   row.unit_basis,
      currency:    row.currency ?? 'THB',
      note:        row.note ?? '',
      periodDays:  row.period_days != null ? String(row.period_days) : '',
      maxQuantity: row.max_quantity != null ? String(row.max_quantity) : '',
      minChargeAmount:   row.min_charge_amount != null ? String(row.min_charge_amount) : '',
      contractStartDate: row.contract_start_date ?? '',
      contractEndDate:   row.contract_end_date ?? '',
      freeDays:          row.free_days != null ? String(row.free_days) : '',
      discountPercent:   row.discount_percent != null ? String(row.discount_percent) : '',
      contractNote:      row.contract_note ?? '',
    });
    setFormProducts([]);
    setError('');
    setSuccess('');
  }

  function handleFormCustomerChange(newCustomerId) {
    setForm((f) => ({ ...f, customerId: newCustomerId, productId: '' }));
    setFormProducts([]);
    if (!newCustomerId) return;
    listCustomerProducts({ customerId: newCustomerId }).then((r) => setFormProducts(r.data ?? []));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const isAllItems = isAllItemsScope(form.productId);
    const categoryTemperature = categoryTemperatureOf(form.productId);
    if (!form.rateId) {
      if (!form.customerId) {
        setError('กรุณาเลือกลูกค้า');
        return;
      }
      if (!form.productId) {
        setError('กรุณาเลือกสินค้า');
        return;
      }
    }
    if (form.serviceType === 'STORAGE' && !categoryTemperature) {
      setError('ค่าฝากสินค้า (STORAGE) ต้องกำหนดตามวิธีการจัดเก็บ (แช่เย็น/แช่แข็ง/ฯลฯ) เท่านั้น กรุณาเลือกวิธีการจัดเก็บแทนการเลือกสินค้ารายตัวหรือ "ทุกรายการ"');
      return;
    }
    setSaving(true);
    setError('');
    const result = await upsertProductServiceRate({
      rateId:            form.rateId || null,
      customerProductId: isAllItems ? null : (form.productId || null),
      customerId:        isAllItems ? form.customerId : null,
      serviceType:       form.serviceType,
      rate:              parseFloat(form.rate),
      unitBasis:         form.unitBasis,
      currency:          form.currency || 'THB',
      note:              form.note,
      isActive:          true,
      periodDays:        form.periodDays,
      temperatureType:   isAllItems ? (categoryTemperature || null) : null,
      maxQuantity:       form.maxQuantity,
      minChargeAmount:   form.minChargeAmount,
      contractStartDate: form.contractStartDate || null,
      contractEndDate:   form.contractEndDate || null,
      freeDays:          form.freeDays,
      discountPercent:   form.discountPercent,
      contractNote:      form.contractNote || null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message ?? 'บันทึกไม่สำเร็จ');
      return;
    }
    setSuccess('บันทึกอัตราค่าบริการเรียบร้อยแล้ว');
    setForm(null);
    await loadRates();
  }

  async function handleDelete(row) {
    const label = row.is_all_items
      ? `ทุกรายการ (${row.service_type})`
      : `${row.product_name ?? row.customer_product_code ?? ''} (${row.service_type})`;
    if (!window.confirm(`ยืนยันลบอัตราค่าบริการ "${label}" ?`)) return;

    setDeletingId(row.id);
    setError('');
    setSuccess('');
    const { data, error: deleteError } = await deleteProductServiceRate(row.id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message ?? 'ลบอัตราค่าบริการไม่สำเร็จ');
      return;
    }
    setSuccess(data?.deleted
      ? 'ลบอัตราค่าบริการเรียบร้อยแล้ว'
      : 'มีการใช้งานอ้างอิงอัตรานี้อยู่ จึงปิดการใช้งานแทนการลบ');
    await loadRates();
  }

  function handleExport() {
    exportStorageRatesExcel(rates, 'storage-rates.xlsx');
  }

  async function handleImportFile(file) {
    setImportBusy(true);
    setImportResult(null);
    setImportErrors([]);
    setError('');
    setSuccess('');

    const lookupResult = await listCustomerProductsForRateImport();
    if (lookupResult.error) {
      setImportBusy(false);
      setError(lookupResult.error.message ?? 'โหลดข้อมูลสินค้าสำหรับนำเข้าไม่สำเร็จ');
      return;
    }

    const lookupMap = buildStorageRateLookupMap(
      (lookupResult.data ?? []).map((cp) => ({ ...cp, customer_code: cp.tgd_customers?.customer_code })),
    );

    const { rows, errors } = await parseStorageRateImportFile(file, lookupMap);
    if (errors.length && rows.length === 0) {
      setImportBusy(false);
      setImportErrors(errors);
      return;
    }

    const { data } = await bulkUpsertProductServiceRates(rows);
    setImportBusy(false);
    setImportResult(data);
    setImportErrors(errors);
    await loadRates();
  }

  const selectedProduct = products.find((p) => p.id === productId);

  // Combine default service types with dynamically discovered ones
  const allServiceTypes = useMemo(() => {
    const defaultVals = SERVICE_TYPES.map(s => s.value);
    const custom = distinctServiceTypes.filter(s => !defaultVals.includes(s));
    return [...SERVICE_TYPES, ...custom.map(c => ({ value: c, label: c, labelEn: 'Custom' }))];
  }, [distinctServiceTypes]);

  return (
    <section className={getPageShellClassName()} data-testid="product-service-rates-page">
      <PageHeader
        title="อัตราค่าบริการตามสินค้า"
        description="กำหนดอัตราค่าบริการแต่ละประเภทตามรายการสินค้าของลูกค้า"
      />

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          ลูกค้า
          <select
            className="form-control"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={{ marginTop: 4, display: 'block', width: '100%' }}
          >
            <option value="">— ลูกค้าทุกราย —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.customer_code} — {c.customer_name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          สินค้า
          <select
            className="form-control"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={!customerId}
            style={{ marginTop: 4, display: 'block', width: '100%' }}
          >
            <option value="">— สินค้าทุกรายการ —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.customer_product_code} — {p.product_name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          ประเภทค่าบริการ
          <select
            className="form-control"
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            style={{ marginTop: 4, display: 'block', width: '100%' }}
          >
            <option value="">ทุกประเภท</option>
            {allServiceTypes.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          สถานะ
          <select
            className="form-control"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            style={{ marginTop: 4, display: 'block', width: '100%' }}
          >
            <option value="">ทั้งหมด</option>
            <option value="true">ใช้งาน</option>
            <option value="false">ปิด</option>
          </select>
        </label>
      </div>

      {/* Product info strip — only when filtered down to exactly one product */}
      {selectedProduct && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
          padding: '10px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedProduct.product_name}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{selectedProduct.customer_product_code}</span>
          <span style={{ fontSize: 12, color: '#2d9348' }}>
            {selectedProduct.uom ? `หน่วย: ${selectedProduct.uom}` : ''}
            {selectedProduct.pack_weight_kg ? `  น้ำหนัก: ${selectedProduct.pack_weight_kg} กก./หน่วย` : ''}
            {selectedProduct.temperature_type ? `  อุณหภูมิ: ${TEMPERATURE_TYPES.find(t => t.value === selectedProduct.temperature_type)?.label || selectedProduct.temperature_type}` : ''}
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', marginLeft: 8 }}>
            ฐานคิดค่าฝาก:
            <select
              className="form-control"
              value={storageChargeBasis}
              disabled={basisSaving}
              onChange={(e) => handleBasisChange(e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, height: 30, width: 'auto', minWidth: 150 }}
            >
              <option value="WEIGHT">น้ำหนัก (WEIGHT)</option>
              <option value="PALLET">พาเลท (PALLET)</option>
            </select>
            {basisSaving && <span style={{ fontSize: 11, color: '#94a3b8' }}>กำลังบันทึก...</span>}
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button type="button" className="btn btn-primary" data-testid="add-service-rate-button" onClick={openCreate}>
          + เพิ่มอัตราค่าบริการ
        </button>
        <ExcelImportExportToolbar
          onTemplate={() => downloadStorageRateTemplate()}
          onExport={handleExport}
          onImportFile={handleImportFile}
          disabled={importBusy}
          exportTestId="storage-rate-export-button"
          templateTestId="storage-rate-template-button"
          importTestId="storage-rate-import-input"
        />
        {importBusy && <span style={{ fontSize: 12, color: '#94a3b8' }}>กำลังนำเข้า...</span>}
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="banner banner-success" style={{ marginBottom: 12 }}>{success}</div>}

      {importResult ? (
        <div
          className={importResult.failed ? 'banner banner-warning' : 'banner banner-success'}
          style={{ marginBottom: 12 }}
          data-testid="storage-rate-import-result"
        >
          นำเข้าสำเร็จ {importResult.succeeded} รายการ{importResult.failed ? ` — ล้มเหลว ${importResult.failed} รายการ` : ''}
        </div>
      ) : null}

      {importErrors.length > 0 ? (
        <div className="banner banner-danger" style={{ marginBottom: 12 }} data-testid="storage-rate-import-errors">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {importErrors.map((msg, idx) => <li key={idx}>{msg.message ?? msg}</li>)}
          </ul>
        </div>
      ) : null}

      {/* Rates table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="storage-rate-table">
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              {['ลูกค้า', 'วิธีการจัดเก็บ', 'ประเภทค่าบริการ', 'อัตรา', 'หน่วย', 'หมายเหตุ', 'สถานะ', ''].map((h) => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#374151', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratesLoading ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : rates.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  ยังไม่มีอัตราค่าบริการ — กด "+ เพิ่มอัตราค่าบริการ" เพื่อเริ่มต้น
                </td>
              </tr>
            ) : rates.map((row) => {
              const ub = UNIT_BASIS.find((u) => u.value === row.unit_basis);
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{row.customer_name ?? '-'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.customer_code ?? ''}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {row.is_all_items ? (
                      <span style={{ fontWeight: 600, color: '#7c3aed' }}>
                        {row.temperature_type
                          ? `— ทุกรายการ: ${TEMPERATURE_TYPES.find((t) => t.value === row.temperature_type)?.label ?? row.temperature_type} —`
                          : '— ทุกรายการ (ทุกอุณหภูมิ) —'}
                      </span>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600 }}>{row.product_name ?? '-'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.customer_product_code ?? ''}</div>
                      </>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}><ServiceBadge type={row.service_type} /></td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                    {Number(row.rate).toLocaleString('th-TH', { minimumFractionDigits: 2 })} {row.currency}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#475569' }}>
                    {ub?.label ?? row.unit_basis}
                    {row.period_days ? <div style={{ fontSize: 11, color: '#0e7a3a' }}>ทุก {row.period_days} วัน</div> : null}
                    {row.max_quantity ? <div style={{ fontSize: 11, color: '#94a3b8' }}>สูงสุด {row.max_quantity}</div> : null}
                    {row.min_charge_amount ? <div style={{ fontSize: 11, color: '#b45309' }}>ขั้นต่ำ {row.min_charge_amount} ฿</div> : null}
                    {row.free_days ? <div style={{ fontSize: 11, color: '#0e7a3a' }}>ฟรี {row.free_days} วันแรก</div> : null}
                    {row.discount_percent ? <div style={{ fontSize: 11, color: '#0e7a3a' }}>ส่วนลด {row.discount_percent}%</div> : null}
                    {(row.contract_start_date || row.contract_end_date) ? (
                      <div style={{ fontSize: 11, color: '#7c3aed' }}>
                        สัญญา: {row.contract_start_date ?? '…'} ถึง {row.contract_end_date ?? '…'}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>
                    {row.note ?? '-'}
                    {row.contract_note ? <div style={{ fontStyle: 'italic', marginTop: 2 }}>{row.contract_note}</div> : null}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: row.is_active ? '#f0fdf4' : '#f1f5f9',
                      color: row.is_active ? '#2d9348' : '#94a3b8',
                    }}>
                      {row.is_active ? 'ใช้งาน' : 'ปิด'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(row)}>
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ color: '#dc2626', borderColor: '#fecaca' }}
                      disabled={deletingId === row.id}
                      onClick={() => handleDelete(row)}
                    >
                      {deletingId === row.id ? 'กำลังลบ...' : 'ลบ'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {form !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>
              {form.rateId ? 'แก้ไขอัตราค่าบริการ' : 'เพิ่มอัตราค่าบริการ'}
            </h3>

            <form onSubmit={handleSubmit}>
              {!form.rateId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    ลูกค้า *
                    <select
                      className="form-control"
                      data-testid="rate-form-customer-select"
                      value={form.customerId}
                      onChange={(e) => handleFormCustomerChange(e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    >
                      <option value="">— เลือกลูกค้า —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.customer_code} — {c.customer_name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    {form.serviceType === 'STORAGE' ? 'วิธีการจัดเก็บ *' : 'สินค้า *'}
                    <select
                      className="form-control"
                      data-testid="rate-form-product-select"
                      value={form.productId}
                      onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                      disabled={!form.customerId}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    >
                      <option value="">{form.serviceType === 'STORAGE' ? '— เลือกวิธีการจัดเก็บ —' : '— เลือกสินค้า —'}</option>
                      {form.serviceType !== 'STORAGE' && (
                        <option value={ALL_ITEMS_VALUE}>— ทุกรายการ (ทุกอุณหภูมิ) —</option>
                      )}
                      {TEMPERATURE_TYPES.filter((t) => t.value).map((t) => (
                        <option key={t.value} value={`${CATEGORY_PREFIX}${t.value}`}>
                          {form.serviceType === 'STORAGE' ? t.label : `— ทุกรายการ: ${t.label} —`}
                        </option>
                      ))}
                      {form.serviceType !== 'STORAGE' && formProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.customer_product_code} — {p.product_name}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {form.serviceType === 'STORAGE'
                        ? 'ค่าฝากสินค้าคิดตามวิธีการจัดเก็บเท่านั้น ไม่สามารถกำหนดรายสินค้าหรือ "ทุกรายการ" ได้'
                        : 'เลือกประเภท (แช่แข็ง/แช่เย็น) เพื่อกำหนดอัตราให้ทุกสินค้าในประเภทนั้นของลูกค้านี้ โดยไม่ต้องเลือกทีละรายการ'}
                    </span>
                  </label>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  ประเภทค่าบริการ *
                </label>
                <input
                  list="service-types-list"
                  data-testid="rate-form-service-type-input"
                  className="form-control"
                  value={form.serviceType}
                  onChange={(e) => handleServiceTypeChange(e.target.value)}
                  disabled={!!form.rateId}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                  placeholder="เลือกหรือพิมพ์ประเภทค่าบริการใหม่"
                  required
                />
                <datalist id="service-types-list">
                  {allServiceTypes.map((s) => (
                    <option key={s.value} value={s.value}>{s.label} ({s.labelEn})</option>
                  ))}
                </datalist>
                {form.serviceType && !SERVICE_TYPES.some((s) => s.value === form.serviceType) && (
                  <p style={{ fontSize: 11, color: '#b45309', margin: '4px 0 0' }}>
                    ⚠ "{form.serviceType}" เป็นประเภทที่กำหนดเอง (custom) — ใบแจ้งหนี้ที่คำนวณอัตโนมัติจากรายการเคลื่อนไหว
                    (รับเข้า/เบิกออก/ค่าฝาก) จะ<strong>ไม่นำอัตรานี้มาคำนวณให้เอง</strong> ต้องเลือกด้วยตนเองเป็นบริการเสริมต่อคำขอ —
                    ถ้าต้องการให้คิดค่าบริการรับเข้า/นำออกอัตโนมัติ กรุณาเลือก "ค่านำเข้า (Handling In)" หรือ
                    "ค่านำออก (Handling Out)" จากรายการแทน
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  อัตรา (฿) *
                  <input
                    className="form-control"
                    data-testid="rate-form-rate-input"
                    type="number"
                    min="0"
                    step="0.0001"
                    required
                    value={form.rate}
                    onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  หน่วยคิด *
                  <select
                    className="form-control"
                    data-testid="rate-form-unit-basis-select"
                    value={form.unitBasis}
                    onChange={(e) => setForm((f) => ({ ...f, unitBasis: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                  >
                    {UNIT_BASIS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  รอบคิดค่าบริการ (วัน)
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="เว้นว่าง = คิดครั้งเดียว"
                    value={form.periodDays}
                    onChange={(e) => setForm((f) => ({ ...f, periodDays: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>เช่น 15 = คิดค่าฝากซ้ำทุก 15 วัน</span>
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  จำนวนสูงสุดต่อครั้ง
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="เว้นว่าง = ไม่จำกัด"
                    value={form.maxQuantity}
                    onChange={(e) => setForm((f) => ({ ...f, maxQuantity: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>เช่น 12 = เสียบปลั๊กไม่เกิน 12 ชม./ครั้ง</span>
                </label>
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 14 }}>
                หมายเหตุ
                <input
                  className="form-control"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม"
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                />
              </label>

              <div style={{ borderTop: '1px dashed #e5e7eb', margin: '4px 0 14px', paddingTop: 14 }} data-testid="rate-contract-terms-section">
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>
                  เงื่อนไขสัญญา (ไม่บังคับ)
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    วันเริ่มสัญญา
                    <input
                      className="form-control"
                      type="date"
                      data-testid="rate-contract-start-date-input"
                      value={form.contractStartDate}
                      onChange={(e) => setForm((f) => ({ ...f, contractStartDate: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    วันสิ้นสุดสัญญา
                    <input
                      className="form-control"
                      type="date"
                      data-testid="rate-contract-end-date-input"
                      value={form.contractEndDate}
                      onChange={(e) => setForm((f) => ({ ...f, contractEndDate: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>เว้นว่างทั้งคู่ = ใช้ได้ตลอดไป ไม่มีวันหมดอายุ</span>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    ค่าฝากขั้นต่ำ (฿)
                    <input
                      className="form-control"
                      data-testid="rate-min-charge-amount-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="เว้นว่าง = ไม่มี"
                      value={form.minChargeAmount}
                      onChange={(e) => setForm((f) => ({ ...f, minChargeAmount: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    ฟรีค่าฝาก (วัน)
                    <input
                      className="form-control"
                      data-testid="rate-free-days-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="เว้นว่าง = ไม่มี"
                      value={form.freeDays}
                      onChange={(e) => setForm((f) => ({ ...f, freeDays: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    ส่วนลด (%)
                    <input
                      className="form-control"
                      data-testid="rate-discount-percent-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="เว้นว่าง = ไม่มี"
                      value={form.discountPercent}
                      onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                    />
                  </label>
                </div>

                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block' }}>
                  หมายเหตุเงื่อนไขสัญญา
                  <textarea
                    className="form-control"
                    data-testid="rate-contract-note-input"
                    rows={2}
                    value={form.contractNote}
                    onChange={(e) => setForm((f) => ({ ...f, contractNote: e.target.value }))}
                    placeholder="เหตุผลของเงื่อนไขพิเศษนี้ เช่น โปรโมชั่นลูกค้าใหม่, สัญญาปีที่ 2 ปรับราคาลด 10%"
                    style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" data-testid="rate-form-cancel-button" onClick={() => setForm(null)} disabled={saving}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary" data-testid="rate-form-save-button" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

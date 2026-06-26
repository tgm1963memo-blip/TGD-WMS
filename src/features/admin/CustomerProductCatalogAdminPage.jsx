import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ExcelImportExportToolbar } from '../../components/customer/ExcelImportExportToolbar.jsx';
import { getCustomers } from '../../services/masterDataService.js';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import {
  deactivateCustomerProduct,
  listCustomerProducts,
  upsertCustomerProduct,
} from '../../services/customerProductCatalogService.js';
import {
  downloadCustomerProductTemplate,
  exportCustomerProductsExcel,
  parseCustomerProductImportFile,
} from '../../utils/customerProductExcelUtils.js';
import { canWriteCustomerCatalog } from '../../security/userManagementPermissions.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const EMPTY_FORM = {
  productId: '',
  customerId: '',
  customerProductCode: '',
  productName: '',
  internalProductCode: '',
  uom: '',
  uomCustom: '',
  packWeightKg: '',
  temperatureType: 'FROZEN',
  argentType: 'NON_ARGENT',
  storageChargeBasis: 'WEIGHT',
  allergenHas: false,
  allergen: '',
  note: '',
};

const UOM_PRESETS = ['กก.', 'กล่อง', 'ถุง', 'ชิ้น', 'แพ็ค', 'โหล', 'ลัง'];

const TEMP_COLORS = { FROZEN: '#1d6fcf', CHILLED: '#0e7a3a', AMBIENT: '#c97d00' };

function TempBadge({ type }) {
  const bg = TEMP_COLORS[type] ?? '#888';
  return (
    <span style={{ display: 'inline-block', background: bg, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {type ?? '-'}
    </span>
  );
}

function ProductFormModal({ form, customers, saving, error, onClose, onSave, onFieldChange }) {
  const isEdit = !!form.productId;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--tgd-card-bg, #fff)',
        borderRadius: 16,
        width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--tgd-border)',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าในแคตตาล็อก'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tgd-muted-text)' }}>
              {isEdit ? 'แก้ไขข้อมูลสินค้าในแคตตาล็อกลูกค้า' : 'เพิ่มรายการสินค้าใหม่สำหรับลูกค้า'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 22,
              cursor: 'pointer', color: 'var(--tgd-muted-text)',
              width: 36, height: 36, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={onSave} style={{ padding: '20px 24px 24px' }}>
          {error && (
            <div className="banner banner-danger" style={{ marginBottom: 16 }} role="alert">{error}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span>ลูกค้า <span style={{ color: 'var(--tgd-danger)' }}>*</span></span>
              <select
                className="form-control"
                onChange={(e) => onFieldChange('customerId', e.target.value)}
                required
                value={form.customerId}
                disabled={isEdit}
              >
                <option value="">เลือกลูกค้า</option>
                {customers.map((row) => (
                  <option key={row.id} value={row.id}>{row.customer_code} — {row.customer_name}</option>
                ))}
              </select>
            </label>
            <label className="form-field" style={{ margin: 0 }}>
              <span>รหัสสินค้าลูกค้า <span style={{ color: 'var(--tgd-danger)' }}>*</span></span>
              <input
                className="form-control"
                onChange={(e) => onFieldChange('customerProductCode', e.target.value)}
                required
                value={form.customerProductCode}
                placeholder="เช่น 10083"
              />
            </label>
          </div>

          <label className="form-field" style={{ margin: '0 0 14px' }}>
            <span>ชื่อสินค้า <span style={{ color: 'var(--tgd-danger)' }}>*</span></span>
            <input
              className="form-control"
              onChange={(e) => onFieldChange('productName', e.target.value)}
              required
              value={form.productName}
              placeholder="ชื่อสินค้าที่แสดงในระบบ"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span>รหัสสินค้าภายใน</span>
              <input
                className="form-control"
                onChange={(e) => onFieldChange('internalProductCode', e.target.value)}
                value={form.internalProductCode}
                placeholder="รหัสภายในคลัง"
              />
            </label>
            <div className="form-field" style={{ margin: 0 }}>
              <span>หน่วย (UOM)</span>
              {(() => {
                const dropdownVal = UOM_PRESETS.includes(form.uom)
                  ? form.uom
                  : form.uomCustom
                    ? 'OTHER'
                    : '';
                return (
                  <>
                    <select
                      className="form-control"
                      style={{ marginBottom: dropdownVal === 'OTHER' ? 6 : 0 }}
                      value={dropdownVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'OTHER') {
                          onFieldChange('uom', '');
                        } else {
                          onFieldChange('uom', val);
                          onFieldChange('uomCustom', '');
                        }
                      }}
                    >
                      <option value="">— เลือกหน่วย —</option>
                      {UOM_PRESETS.map((u) => <option key={u} value={u}>{u}</option>)}
                      <option value="OTHER">อื่นๆ (ระบุเอง)</option>
                    </select>
                    {dropdownVal === 'OTHER' && (
                      <input
                        className="form-control"
                        placeholder="ระบุหน่วย เช่น KG หรือ ชิ้น"
                        value={form.uomCustom}
                        onChange={(e) => onFieldChange('uomCustom', e.target.value)}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span>อุณหภูมิ</span>
              <select className="form-control" onChange={(e) => onFieldChange('temperatureType', e.target.value)} value={form.temperatureType}>
                <option value="FROZEN">FROZEN (แช่แข็ง)</option>
                <option value="CHILLED">CHILLED (แช่เย็น)</option>
                <option value="AMBIENT">AMBIENT (อุณหภูมิห้อง)</option>
              </select>
            </label>
            <label className="form-field" style={{ margin: 0 }}>
              <span>ฐานคิดค่าฝาก</span>
              <select className="form-control" onChange={(e) => onFieldChange('storageChargeBasis', e.target.value)} value={form.storageChargeBasis}>
                <option value="WEIGHT">น้ำหนัก (WEIGHT)</option>
                <option value="PALLET">พาเลท (PALLET)</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span>น้ำหนักต่อหน่วย (กก.)</span>
              <input
                className="form-control"
                type="number"
                min="0"
                step="0.001"
                onChange={(e) => onFieldChange('packWeightKg', e.target.value)}
                value={form.packWeightKg}
                placeholder="เช่น 1.500"
              />
            </label>
            <div className="form-field" style={{ margin: 0 }}>
              <span>สารก่อภูมิแพ้ (Allergen)</span>
              <div style={{ display: 'flex', gap: 8, marginBottom: form.allergenHas ? 6 : 0 }}>
                <button
                  type="button"
                  onClick={() => { onFieldChange('allergenHas', false); onFieldChange('allergen', ''); }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `1px solid ${!form.allergenHas ? '#059669' : 'var(--tgd-border)'}`,
                    background: !form.allergenHas ? '#ecfdf5' : 'transparent',
                    color: !form.allergenHas ? '#059669' : 'var(--tgd-muted-text)',
                    fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  ไม่มี
                </button>
                <button
                  type="button"
                  onClick={() => onFieldChange('allergenHas', true)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `1px solid ${form.allergenHas ? '#ef4444' : 'var(--tgd-border)'}`,
                    background: form.allergenHas ? '#fef2f2' : 'transparent',
                    color: form.allergenHas ? '#ef4444' : 'var(--tgd-muted-text)',
                    fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  มี
                </button>
              </div>
              {form.allergenHas && (
                <input
                  className="form-control"
                  placeholder="ระบุสารก่อภูมิแพ้ เช่น Gluten, Dairy, Nuts"
                  value={form.allergen}
                  onChange={(e) => onFieldChange('allergen', e.target.value)}
                />
              )}
            </div>
          </div>

          <label className="form-field" style={{ margin: '0 0 20px' }}>
            <span>หมายเหตุ</span>
            <textarea className="form-control" onChange={(e) => onFieldChange('note', e.target.value)} rows={2} value={form.note} style={{ resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CustomerProductCatalogAdminPage() {
  const { session } = useAuth();
  const t = useTranslation();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [formError, setFormError] = useState('');

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((row) => [row.id, row])),
    [customers],
  );

  async function loadProducts(customerId = filterCustomerId) {
    setLoading(true);
    setError('');
    const filters = {};
    if (customerId) filters.customerId = customerId;
    const result = await listCustomerProducts(filters);
    if (result.error) {
      setError(result.error.message ?? t('catalog_load_error'));
      setProducts([]);
    } else {
      setProducts(result.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentUserProfile(session?.user?.id), getCustomers()]).then(([profileResult, customerResult]) => {
      if (!active) return;
      setCanWrite(canWriteCustomerCatalog(profileResult.data?.role ?? ''));
      setCustomers(customerResult.data ?? []);
    });
    loadProducts();
    return () => { active = false; };
  }, []);

  function openCreate() {
    setForm({ ...EMPTY_FORM, customerId: filterCustomerId });
    setFormError('');
    setSuccess('');
    setError('');
  }

  function openEdit(row) {
    setForm({
      productId: row.id,
      customerId: row.customer_id,
      customerProductCode: row.customer_product_code ?? '',
      productName: row.product_name ?? '',
      internalProductCode: row.internal_product_code ?? '',
      uom: row.uom ?? '',
      uomCustom: row.uom && !UOM_PRESETS.includes(row.uom) ? row.uom : '',
      packWeightKg: row.pack_weight_kg != null ? String(row.pack_weight_kg) : '',
      temperatureType: row.temperature_type ?? 'FROZEN',
      argentType: row.argent_type ?? 'NON_ARGENT',
      storageChargeBasis: row.storage_charge_basis ?? 'WEIGHT',
      allergenHas: !!(row.allergen),
      allergen: row.allergen ?? '',
      note: row.note ?? '',
    });
    setFormError('');
    setSuccess('');
    setError('');
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    const result = await upsertCustomerProduct({
      productId: form.productId || null,
      customerId: form.customerId || null,
      customerProductCode: form.customerProductCode,
      productName: form.productName,
      internalProductCode: form.internalProductCode,
      uom: form.uom || form.uomCustom,
      packWeightKg: form.packWeightKg !== '' ? parseFloat(form.packWeightKg) : null,
      temperatureType: form.temperatureType,
      argentType: form.argentType,
      storageChargeBasis: form.storageChargeBasis,
      allergen: form.allergen,
      note: form.note,
      isActive: true,
    });

    setSaving(false);

    if (result.error) {
      setFormError(result.error.message ?? t('catalog_save_error'));
      return;
    }

    setSuccess(t('catalog_save_success'));
    setForm(null);
    await loadProducts();
  }

  async function handleDeactivate(productId) {
    if (!window.confirm('ปิดใช้งานสินค้านี้?')) return;
    setSaving(true);
    setError('');
    const result = await deactivateCustomerProduct(productId);
    setSaving(false);
    if (result.error) {
      setError(result.error.message ?? t('catalog_save_error'));
      return;
    }
    setSuccess(t('catalog_deactivate_success'));
    await loadProducts();
  }

  async function handleImportFile(file) {
    if (!filterCustomerId) {
      setError(t('catalog_import_customer_required'));
      return;
    }
    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const { rows, errors } = await parseCustomerProductImportFile(file);
      if (errors.length) { setError(errors.join(' ')); return; }
      if (!rows.length) { setError(t('excel_import_empty')); return; }

      let imported = 0;
      for (const row of rows) {
        const result = await upsertCustomerProduct({
          customerId: filterCustomerId,
          customerProductCode: row.customerProductCode,
          productName: row.productName,
          internalProductCode: row.internalProductCode,
          uom: row.uom,
          temperatureType: row.temperatureType,
          argentType: row.argentType,
          storageChargeBasis: row.storageChargeBasis,
          note: row.note,
          isActive: true,
        });
        if (result.error) { setError(result.error.message ?? t('catalog_save_error')); return; }
        imported += 1;
      }

      setSuccess(`${imported} ${t('excel_import_success')}`);
      await loadProducts();
    } catch (importError) {
      setError(importError.message ?? t('excel_import_error'));
    } finally {
      setImporting(false);
    }
  }

  // Filtered products
  const filtered = products.filter((p) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      (p.customer_product_code ?? '').toLowerCase().includes(q) ||
      (p.product_name ?? '').toLowerCase().includes(q) ||
      (p.internal_product_code ?? '').toLowerCase().includes(q)
    );
  });

  if (!loading && !canWrite) {
    return (
      <section className="page-shell" data-testid="customer-product-catalog-admin-page">
        <PageHeader title={t('catalog_admin_title')} description={t('catalog_admin_description')} />
        <div className="banner banner-warning" role="status">{t('catalog_admin_only')}</div>
      </section>
    );
  }

  return (
    <section className="page-shell" data-testid="customer-product-catalog-admin-page">
      <PageHeader
        title={t('catalog_admin_title')}
        description={t('catalog_admin_description')}
        actions={canWrite ? (
          <button className="btn btn-primary" data-testid="catalog-admin-create-button" onClick={openCreate} type="button">
            + {t('catalog_create')}
          </button>
        ) : null}
      />

      {/* Filter & tools bar */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
        background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 16,
      }}>
        <label className="form-field" style={{ margin: 0, flex: '0 0 240px' }}>
          <span style={{ fontSize: 12 }}>{t('catalog_filter_customer')}</span>
          <select
            className="form-control"
            data-testid="catalog-admin-customer-filter"
            onChange={(e) => {
              setFilterCustomerId(e.target.value);
              loadProducts(e.target.value);
            }}
            value={filterCustomerId}
          >
            <option value="">{t('catalog_all_customers')}</option>
            {customers.map((row) => (
              <option key={row.id} value={row.id}>{row.customer_code} — {row.customer_name}</option>
            ))}
          </select>
        </label>
        <label className="form-field" style={{ margin: 0, flex: '1 1 200px' }}>
          <span style={{ fontSize: 12 }}>ค้นหาสินค้า</span>
          <input
            className="form-control"
            type="search"
            placeholder="รหัสสินค้า / ชื่อสินค้า..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </label>
        <div className="form-field" style={{ margin: 0, flex: '0 0 auto' }}>
          <span style={{ fontSize: 12 }}>{t('catalog_excel_tools')}</span>
          <ExcelImportExportToolbar
            disabled={saving || importing}
            exportTestId="catalog-admin-export-button"
            importTestId="catalog-admin-import-input"
            onExport={() => exportCustomerProductsExcel(products)}
            onImportFile={handleImportFile}
            onTemplate={() => {
              const customer = customers.find((c) => c.id === filterCustomerId) ?? null;
              downloadCustomerProductTemplate(customer);
            }}
            templateTestId="catalog-admin-template-button"
          />
        </div>
      </div>

      {/* Alerts */}
      {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}
      {success ? <div className="banner banner-success" role="status" style={{ marginBottom: 12 }}>{success}</div> : null}

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="table-card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--tgd-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--tgd-muted-text)', fontWeight: 600 }}>
              {filtered.length} รายการ{searchText || filterCustomerId ? ' (กรองแล้ว)' : ''}
            </span>
            {(searchText || filterCustomerId) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setSearchText(''); setFilterCustomerId(''); loadProducts(''); }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" data-testid="catalog-admin-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>ลูกค้า</th>
                  <th>รหัสสินค้าลูกค้า</th>
                  <th>ชื่อสินค้า</th>
                  <th>รหัสภายใน</th>
                  <th>หน่วย</th>
                  <th>อุณหภูมิ</th>
                  <th>ฐานคิดค่าฝาก</th>
                  <th>สถานะ</th>
                  <th style={{ width: 120 }}>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--tgd-muted-text)' }}>
                      {products.length === 0 ? t('catalog_empty') : 'ไม่พบสินค้าที่ตรงกับเงื่อนไข'}
                    </td>
                  </tr>
                ) : filtered.map((row) => {
                  const cust = customerMap[row.customer_id];
                  return (
                    <tr key={row.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {cust ? (
                          <span>
                            <span style={{ fontWeight: 600 }}>{cust.customer_code}</span>
                            <span style={{ color: 'var(--tgd-muted-text)', marginLeft: 4 }}>{cust.customer_name}</span>
                          </span>
                        ) : (row.customer_id?.slice(0, 8) ?? '-')}
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {row.customer_product_code}
                      </td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.product_name}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--tgd-muted-text)' }}>
                        {row.internal_product_code ?? '-'}
                      </td>
                      <td style={{ fontSize: 12 }}>{row.uom ?? '-'}</td>
                      <td><TempBadge type={row.temperature_type} /></td>
                      <td style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>{row.storage_charge_basis ?? '-'}</td>
                      <td><StatusBadge value={row.is_active} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canWrite && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => openEdit(row)}
                              type="button"
                            >
                              {t('edit')}
                            </button>
                          )}
                          {canWrite && row.is_active && (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={saving}
                              onClick={() => handleDeactivate(row.id)}
                              type="button"
                            >
                              {t('catalog_deactivate')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {form !== null && (
        <ProductFormModal
          form={form}
          customers={customers}
          saving={saving}
          error={formError}
          onClose={() => setForm(null)}
          onSave={handleSubmit}
          onFieldChange={updateField}
        />
      )}
    </section>
  );
}

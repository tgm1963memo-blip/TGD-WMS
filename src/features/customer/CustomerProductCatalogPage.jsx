import { ClipboardList, Download, Info, Package, Search, Upload } from 'lucide-react';
import { IconLabel } from '../../components/ui/IconLabel.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import {
  deactivateCustomerProduct,
  listCustomerProducts,
  listR3CarcassTypes,
  upsertCustomerProduct,
} from '../../services/customerProductCatalogService.js';
import { R3CarcassTypeSelect } from '../../components/customer/R3CarcassTypeSelect.jsx';
import { formatR3CarcassType, resolveR3CarcassTypeCode } from '../../utils/r3PermitComparisonUtils.js';
import {
  deleteCustomerProductUnit,
  upsertCustomerProductUnit,
} from '../../services/customerProductUnitService.js';
import { ProductUnitsEditor, saveProductUnits, unitsFromCatalogRow } from '../../components/customer/ProductUnitsEditor.jsx';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { readNewProductPrefill, withoutNewProductPrefill } from '../../utils/catalogProductPrefill.js';

const TEMPLATE_COLUMNS = [
  'รหัสสินค้า (ของท่าน)*',
  'ชื่อสินค้า*',
  'หน่วย (UOM)',
  'อุณหภูมิจัดเก็บ (FROZEN/CHILLED/AMBIENT)',
  'น้ำหนักต่อหน่วย (กก.)',
  'สารก่อภูมิแพ้ (มี/ไม่มี)',
  'รายละเอียดสารก่อภูมิแพ้',
  'ประเภทสินค้า',
  'หมายเหตุ',
  // Appended last so templates downloaded before this column existed
  // still import with every other column in place.
  'ประเภทซาก ร.3 (เช่น มันสุกรแช่แข็ง)',
];
const TEMPLATE_COL_WIDTHS = [14, 30, 10, 30, 18, 18, 24, 16, 20, 26];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLUMNS,
    ['10001', 'ตัวอย่างสินค้า A', 'กก.', 'FROZEN', '1.500', 'ไม่มี', '', 'หมู', '', 'เนื้อสุกรแช่แข็ง'],
    ['10002', 'ตัวอย่างสินค้า B', 'กล่อง', 'CHILLED', '0.500', 'มี', 'Gluten, Dairy', 'ไก่', 'หมายเหตุ', ''],
  ]);
  ws['!cols'] = TEMPLATE_COL_WIDTHS.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'product_catalog_template.xlsx');
}

function exportProducts(products, r3Types = []) {
  const rows = products.map((p) => ([
    p.customer_product_code ?? '',
    p.product_name ?? '',
    p.uom ?? '',
    p.temperature_type ?? '',
    p.pack_weight_kg ?? '',
    p.allergen ? 'มี' : 'ไม่มี',
    p.allergen ?? '',
    p.product_category ?? '',
    p.note ?? '',
    r3Types.find((t) => t.code === p.r3_carcass_type_code)?.label_th ?? '',
  ]));
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...rows]);
  ws['!cols'] = TEMPLATE_COL_WIDTHS.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'สินค้า');
  XLSX.writeFile(wb, 'product_catalog_export.xlsx');
}

function parseImportFile(file, r3Types = []) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { resolve([]); return; }
        const dataRows = rows.slice(1).filter((r) => r[0] || r[1]);
        const parsed = dataRows.map((r) => ({
          customerProductCode: String(r[0] ?? '').trim(),
          productName: String(r[1] ?? '').trim(),
          uom: String(r[2] ?? '').trim(),
          temperatureType: (['FROZEN', 'CHILLED', 'AMBIENT'].includes(String(r[3]).trim().toUpperCase())
            ? String(r[3]).trim().toUpperCase() : 'FROZEN'),
          packWeightKg: r[4] !== '' && !isNaN(Number(r[4])) ? Number(r[4]) : null,
          allergenHas: String(r[5] ?? '').trim() === 'มี',
          allergen: String(r[6] ?? '').trim(),
          productCategory: String(r[7] ?? '').trim(),
          note: String(r[8] ?? '').trim(),
          r3Raw: String(r[9] ?? '').trim(),
          r3CarcassTypeCode: resolveR3CarcassTypeCode(r[9], r3Types),
        })).filter((r) => r.customerProductCode && r.productName);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const EMPTY_FORM = {
  productId: '',
  customerProductCode: '',
  productName: '',
  internalProductCode: '',
  uom: '',
  uomCustom: '',
  packWeightKg: '',
  temperatureType: 'FROZEN',
  allergenHas: false,
  allergen: '',
  productCategory: '',
  r3CarcassTypeCode: null,
  note: '',
  units: [],
  originalUnits: [],
};

const UOM_PRESETS = ['กก.', 'กล่อง', 'ถุง', 'ชิ้น', 'แพ็ค', 'โหล', 'ลัง'];
const TEMP_COLORS = { FROZEN: '#1d6fcf', CHILLED: '#0e7a3a', AMBIENT: '#c97d00' };

function TempBadge({ type }) {
  const bg = TEMP_COLORS[type] ?? '#888';
  return (
    <span style={{
      display: 'inline-block', background: bg, color: '#fff',
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {type ?? '-'}
    </span>
  );
}

function ProductFormModal({ form, products, r3Types, saving, error, onClose, onSave, onFieldChange }) {
  // Suggests categories already used in this customer's own catalog
  // (free-text field, no fixed enum) so the same label gets reused
  // consistently instead of near-duplicates ("หมู" vs "Pork").
  const categorySuggestions = useMemo(
    () => [...new Set((products ?? []).map((p) => p.product_category).filter(Boolean))].sort(),
    [products],
  );
  const isEdit = !!form.productId;
  // Tracks whether "อื่นๆ (ระบุเอง)" is the active dropdown choice, independent
  // of whether uomCustom has been typed into yet — deriving this from
  // uomCustom's truthiness alone meant picking "OTHER" on a brand-new
  // product (where uomCustom starts empty) snapped the dropdown straight
  // back to the blank placeholder on the very next render, hiding the
  // custom-text input before anything could be typed into it.
  const [uomIsCustom, setUomIsCustom] = useState(
    () => Boolean(form.uomCustom) || (Boolean(form.uom) && !UOM_PRESETS.includes(form.uom)),
  );
  const uomDropdownVal = uomIsCustom ? 'OTHER' : (UOM_PRESETS.includes(form.uom) ? form.uom : '');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าในแคตตาล็อก'}
      size="sm"
      closeOnBackdrop={false}
    >
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--tgd-muted-text)' }}>
          {isEdit ? 'แก้ไขข้อมูลสินค้าในรายการของคุณ' : 'เพิ่มรายการสินค้าใหม่สำหรับการฝาก-เบิกสินค้า'}
        </p>

        <form onSubmit={onSave}>
          {error && (
            <div className="banner banner-danger" style={{ marginBottom: 14 }} role="alert">{error}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span>รหัสสินค้า (ของท่าน) <span style={{ color: 'var(--tgd-danger)' }}>*</span></span>
              <input
                className="form-control"
                onChange={(e) => onFieldChange('customerProductCode', e.target.value)}
                placeholder="เช่น 10083"
                required
                value={form.customerProductCode}
              />
            </label>
            <div className="form-field" style={{ margin: 0 }}>
              <span>หน่วย (UOM)</span>
              <select
                className="form-control"
                style={{ marginBottom: uomDropdownVal === 'OTHER' ? 6 : 0 }}
                value={uomDropdownVal}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'OTHER') {
                    setUomIsCustom(true);
                    onFieldChange('uom', '');
                  } else {
                    setUomIsCustom(false);
                    onFieldChange('uom', val);
                    onFieldChange('uomCustom', '');
                  }
                }}
              >
                <option value="">— เลือกหน่วย —</option>
                {UOM_PRESETS.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value="OTHER">อื่นๆ (ระบุเอง)</option>
              </select>
              {uomDropdownVal === 'OTHER' && (
                <input
                  className="form-control"
                  placeholder="ระบุหน่วย เช่น KG, Pcs"
                  value={form.uomCustom}
                  onChange={(e) => onFieldChange('uomCustom', e.target.value)}
                  autoFocus
                />
              )}
            </div>
          </div>

          <label className="form-field" style={{ margin: '0 0 12px' }}>
            <span>ชื่อสินค้า <span style={{ color: 'var(--tgd-danger)' }}>*</span></span>
            <input
              className="form-control"
              onChange={(e) => onFieldChange('productName', e.target.value)}
              placeholder="ชื่อสินค้าที่แสดงในระบบ"
              required
              value={form.productName}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span>อุณหภูมิจัดเก็บ</span>
              <select
                className="form-control"
                onChange={(e) => onFieldChange('temperatureType', e.target.value)}
                value={form.temperatureType}
              >
                <option value="FROZEN">FROZEN (แช่แข็ง)</option>
                <option value="CHILLED">CHILLED (แช่เย็น)</option>
                <option value="AMBIENT">AMBIENT (อุณหภูมิห้อง)</option>
              </select>
            </label>
            <label className="form-field" style={{ margin: 0 }}>
              <span>น้ำหนักต่อหน่วย (กก.)</span>
              <input
                className="form-control"
                type="number"
                min="0"
                step="0.001"
                onChange={(e) => onFieldChange('packWeightKg', e.target.value)}
                placeholder="เช่น 1.500"
                value={form.packWeightKg}
              />
            </label>
          </div>

          <div className="form-field" style={{ margin: '0 0 12px' }}>
            <span>สารก่อภูมิแพ้ (Allergen)</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: form.allergenHas ? 6 : 0 }}>
              {[
                { label: 'ไม่มี', val: false, activeColor: 'var(--color-success)', activeBg: '#ecfdf5' },
                { label: 'มี', val: true, activeColor: '#ef4444', activeBg: 'var(--color-danger-soft)' },
              ].map(({ label, val, activeColor, activeBg }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { onFieldChange('allergenHas', val); if (!val) onFieldChange('allergen', ''); }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `1px solid ${form.allergenHas === val ? activeColor : 'var(--tgd-border)'}`,
                    background: form.allergenHas === val ? activeBg : 'transparent',
                    color: form.allergenHas === val ? activeColor : 'var(--tgd-muted-text)',
                    fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  }}
                >{label}</button>
              ))}
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

          <ProductUnitsEditor
            units={form.units}
            onUnitsChange={(units) => onFieldChange('units', units)}
            disabled={saving}
          />

          <label className="form-field" style={{ margin: '0 0 12px' }}>
            <span>ประเภทสินค้า</span>
            <input
              className="form-control"
              list="customer-product-category-suggestions"
              onChange={(e) => onFieldChange('productCategory', e.target.value)}
              value={form.productCategory}
              placeholder="เช่น หมู, ไก่, อาหารทะเล — กำหนดเองตามที่ต้องการจัดกลุ่ม"
            />
            <datalist id="customer-product-category-suggestions">
              {categorySuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>

          <label className="form-field" style={{ margin: '0 0 12px' }}>
            <span>ประเภทซากตาม ร.3</span>
            <R3CarcassTypeSelect
              carcassTypes={r3Types}
              value={form.r3CarcassTypeCode}
              onChange={(code) => onFieldChange('r3CarcassTypeCode', code)}
              data-testid="catalog-r3-carcass-type"
            />
            <small style={{ color: 'var(--tgd-muted-text)', fontSize: 11 }}>
              ใช้เทียบยอดเบิกกับใบ ร.3 — เลือกตามประเภทที่กรมปศุสัตว์ระบุในใบอนุญาต
            </small>
          </label>

          <label className="form-field" style={{ margin: '0 0 18px' }}>
            <span>หมายเหตุ</span>
            <textarea
              className="form-control"
              onChange={(e) => onFieldChange('note', e.target.value)}
              rows={2}
              style={{ resize: 'vertical' }}
              value={form.note}
            />
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
    </Modal>
  );
}

export function CustomerProductCatalogPage() {
  const { customerId, role, loading: profileLoading } = useCustomerPortalProfile();
  const canWrite = role === 'customer_admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [r3Types, setR3Types] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const importFileRef = useRef(null);

  async function loadProducts() {
    if (!customerId) return;
    setLoading(true);
    setError('');
    const result = await listCustomerProducts({ customerId, activeOnly: false });
    if (result.error) {
      setError(result.error.message ?? 'โหลดข้อมูลสินค้าไม่สำเร็จ');
      setProducts([]);
    } else {
      setProducts(result.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!profileLoading && customerId) {
      loadProducts();
    } else if (!profileLoading && !customerId) {
      setLoading(false);
    }
  }, [profileLoading, customerId]);

  useEffect(() => {
    listR3CarcassTypes().then((r) => setR3Types(r.data ?? []));
  }, []);

  // Arrived from a deposit import's "สร้างสินค้า" link: open the add form.
  useEffect(() => {
    const prefill = readNewProductPrefill(searchParams);
    if (!prefill || !canWrite) return;
    setForm({ ...EMPTY_FORM, ...prefill });
    setSearchParams(withoutNewProductPrefill(searchParams), { replace: true });
  }, [canWrite]);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setSuccess('');
    setError('');
  }

  function openEdit(row) {
    setForm({
      productId: row.id,
      customerProductCode: row.customer_product_code ?? '',
      productName: row.product_name ?? '',
      internalProductCode: row.internal_product_code ?? '',
      uom: UOM_PRESETS.includes(row.uom) ? row.uom : '',
      uomCustom: row.uom && !UOM_PRESETS.includes(row.uom) ? row.uom : '',
      packWeightKg: row.pack_weight_kg != null ? String(row.pack_weight_kg) : '',
      temperatureType: row.temperature_type ?? 'FROZEN',
      allergenHas: !!(row.allergen),
      allergen: row.allergen ?? '',
      productCategory: row.product_category ?? '',
      r3CarcassTypeCode: row.r3_carcass_type_code ?? null,
      note: row.note ?? '',
      units: unitsFromCatalogRow(row),
      originalUnits: row.units ?? [],
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
      customerId,
      customerProductCode: form.customerProductCode,
      productName: form.productName,
      internalProductCode: form.internalProductCode,
      uom: form.uom || form.uomCustom,
      packWeightKg: form.packWeightKg !== '' ? parseFloat(form.packWeightKg) : null,
      temperatureType: form.temperatureType,
      allergen: form.allergenHas ? form.allergen : '',
      productCategory: form.productCategory,
      r3CarcassTypeCode: form.r3CarcassTypeCode,
      note: form.note,
      isActive: true,
    });

    if (result.error) {
      setSaving(false);
      setFormError(result.error.message ?? 'บันทึกไม่สำเร็จ');
      return;
    }

    const productId = result.data?.id ?? form.productId;
    const unitWarnings = await saveProductUnits({
      units: form.units,
      originalUnits: form.originalUnits,
      productId,
      upsertCustomerProductUnit,
      deleteCustomerProductUnit,
    });

    setSaving(false);
    const baseMessage = form.productId ? 'แก้ไขสินค้าเรียบร้อย' : 'เพิ่มสินค้าเรียบร้อยแล้ว';
    setSuccess(unitWarnings.length ? `${baseMessage} (${unitWarnings.join(' | ')})` : baseMessage);
    setForm(null);
    await loadProducts();
  }

  async function handleDeactivate(row) {
    if (!window.confirm(`ปิดใช้งานสินค้า "${row.product_name}" ?`)) return;
    setSaving(true);
    setError('');
    const result = await deactivateCustomerProduct(row.id);
    setSaving(false);
    if (result.error) {
      setError(result.error.message ?? 'ปิดใช้งานไม่สำเร็จ');
      return;
    }
    setSuccess('ปิดใช้งานสินค้าเรียบร้อย');
    await loadProducts();
  }

  async function handleImportFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError('');
    setSuccess('');
    try {
      const parsed = await parseImportFile(file, r3Types);
      if (parsed.length === 0) { setError('ไม่พบข้อมูลในไฟล์ หรือข้อมูลไม่ครบถ้วน'); return; }
      setImportPreview(parsed);
    } catch {
      setError('อ่านไฟล์ไม่สำเร็จ กรุณาใช้ไฟล์ .xlsx ตาม template');
    }
  }

  async function handleImportConfirm() {
    if (!importPreview || !customerId) return;
    setImporting(true); setError(''); setSuccess('');
    let ok = 0; let fail = 0;
    for (const row of importPreview) {
      const result = await upsertCustomerProduct({
        productId: null,
        customerId,
        customerProductCode: row.customerProductCode,
        productName: row.productName,
        internalProductCode: '',
        uom: row.uom,
        packWeightKg: row.packWeightKg,
        temperatureType: row.temperatureType,
        allergen: row.allergenHas ? row.allergen : '',
        productCategory: row.productCategory,
        // Blank ร.3 cell keeps whatever the product already has.
        r3CarcassTypeCode: row.r3CarcassTypeCode
          ?? products.find((p) => p.customer_product_code === row.customerProductCode)?.r3_carcass_type_code
          ?? null,
        note: row.note,
        isActive: true,
      });
      if (result.error) fail += 1; else ok += 1;
    }
    setImporting(false);
    setImportPreview(null);
    if (fail > 0) setError(`นำเข้าสำเร็จ ${ok} รายการ, ล้มเหลว ${fail} รายการ (รหัสสินค้าซ้ำจะอัปเดตอัตโนมัติ)`);
    else setSuccess(`นำเข้าสำเร็จ ${ok} รายการ`);
    await loadProducts();
  }

  const activeCount = products.filter((p) => p.is_active).length;

  const filtered = products.filter((p) => {
    if (!showInactive && !p.is_active) return false;
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      (p.customer_product_code ?? '').toLowerCase().includes(q) ||
      (p.product_name ?? '').toLowerCase().includes(q)
    );
  });

  if (profileLoading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-product-catalog-page">
        <PageHeader title="แคตตาล็อกสินค้า" description="รายการสินค้าของคุณสำหรับการฝาก-เบิกสินค้า" />
        <LoadingState />
      </section>
    );
  }

  if (!customerId) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-product-catalog-page">
        <PageHeader title="แคตตาล็อกสินค้า" description="รายการสินค้าของคุณสำหรับการฝาก-เบิกสินค้า" />
        <div className="banner banner-warning" role="status">
          บัญชีนี้ไม่ได้ผูกกับข้อมูลลูกค้า กรุณาติดต่อผู้ดูแลระบบ
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-product-catalog-page">
      <PageHeader
        title="แคตตาล็อกสินค้า"
        description="รายการสินค้าที่ใช้สำหรับแจ้งฝาก-เบิกสินค้าในระบบ TGC"
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              title="ดาวน์โหลด Template Excel สำหรับนำเข้าสินค้า"
              onClick={downloadTemplate}
            >
              <IconLabel icon={Download} size={14} gap={6}>Template</IconLabel>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              title="ส่งออกรายการสินค้าปัจจุบันเป็น Excel"
              onClick={() => exportProducts(products, r3Types)}
              disabled={products.length === 0}
            >
              <IconLabel icon={Upload} size={14} gap={6}>Export</IconLabel>
            </button>
            {canWrite && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  title="นำเข้าสินค้าจากไฟล์ Excel"
                  onClick={() => importFileRef.current?.click()}
                >
                  <IconLabel icon={Download} size={14} gap={6}>Import</IconLabel>
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleImportFileChange}
                />
                <button
                  className="btn btn-primary"
                  data-testid="catalog-create-button"
                  onClick={openCreate}
                  type="button"
                >
                  + เพิ่มสินค้า
                </button>
              </>
            )}
          </div>
        )}
      />

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)',
          borderRadius: 10, padding: '10px 18px', display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ display: 'flex' }}><Package size={22} aria-hidden="true" /></span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: 'var(--tgd-primary)' }}>{activeCount}</div>
            <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>สินค้าที่ใช้งานอยู่</div>
          </div>
        </div>
        <div style={{
          background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)',
          borderRadius: 10, padding: '10px 18px', display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ display: 'flex' }}><ClipboardList size={22} aria-hidden="true" /></span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{products.length}</div>
            <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>สินค้าทั้งหมด</div>
          </div>
        </div>
        {!canWrite && (
          <div style={{
            background: '#fef9c3', border: '1px solid #f59e0b',
            borderRadius: 10, padding: '10px 16px',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span style={{ display: 'flex', color: 'var(--color-warning-strong)' }}><Info size={16} aria-hidden="true" /></span>
            <div style={{ fontSize: 12, color: 'var(--color-warning-strong)' }}>
              สิทธิ์ดูข้อมูลเท่านั้น — ติดต่อ <strong>Customer Admin</strong> เพื่อเพิ่ม/แก้ไขสินค้า
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{
        background: 'var(--tgd-surface)', border: '1px solid var(--tgd-border)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 14,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--tgd-muted-text)', fontSize: 16, flexShrink: 0, display: 'flex' }}><Search size={16} aria-hidden="true" /></span>
        <input
          className="form-control"
          style={{ flex: 1, margin: 0, minWidth: 160 }}
          type="search"
          placeholder="ค้นหารหัสสินค้า / ชื่อสินค้า..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          data-testid="catalog-search"
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          แสดงสินค้าที่ปิดแล้ว
        </label>
        {searchText && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSearchText('')}>
            ล้าง
          </button>
        )}
      </div>

      {/* Alerts */}
      {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}
      {success ? <div className="banner banner-success" role="status" style={{ marginBottom: 12 }}>{success}</div> : null}

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="table-card" style={{ padding: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--tgd-border)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--tgd-muted-text)', fontWeight: 600 }}>
              {filtered.length} รายการ{searchText ? ' (ค้นหา)' : ''}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" data-testid="catalog-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>รหัสสินค้า</th>
                  <th>ชื่อสินค้า</th>
                  <th>หน่วย</th>
                  <th>อุณหภูมิ</th>
                  <th>น้ำหนัก/หน่วย</th>
                  <th>Allergen</th>
                  <th>ประเภทสินค้า</th>
                  <th>ประเภท ร.3</th>
                  <th>สถานะ</th>
                  {canWrite && <th style={{ width: 130 }}>การกระทำ</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canWrite ? 10 : 9}
                      style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tgd-muted-text)' }}
                    >
                      {products.length === 0
                        ? (canWrite
                          ? 'ยังไม่มีสินค้าในแคตตาล็อก กด "+ เพิ่มสินค้า" เพื่อเริ่มต้น'
                          : 'ยังไม่มีสินค้าในแคตตาล็อก')
                        : 'ไม่พบสินค้าที่ตรงกับคำค้น'}
                    </td>
                  </tr>
                ) : filtered.map((row) => (
                  <tr key={row.id} style={{ opacity: row.is_active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {row.customer_product_code}
                    </td>
                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.product_name}
                      {row.note && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--tgd-muted-text)' }}>{row.note}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{row.uom ?? '-'}</td>
                    <td><TempBadge type={row.temperature_type} /></td>
                    <td style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>
                      {row.pack_weight_kg != null ? `${row.pack_weight_kg} กก.` : '-'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {row.allergen
                        ? <span style={{ color: '#ef4444', fontWeight: 600 }}>มี</span>
                        : <span style={{ color: 'var(--tgd-muted-text)' }}>-</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{row.product_category ?? '-'}</td>
                    <td style={{ fontSize: 12 }}>{formatR3CarcassType(row.r3_carcass_type_code, r3Types)}</td>
                    <td><StatusBadge value={row.is_active} /></td>
                    {canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => openEdit(row)}
                            type="button"
                          >
                            แก้ไข
                          </button>
                          {row.is_active && (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={saving}
                              onClick={() => handleDeactivate(row)}
                              type="button"
                            >
                              ปิด
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form !== null && (
        <ProductFormModal
          form={form}
          products={products}
          r3Types={r3Types}
          saving={saving}
          error={formError}
          onClose={() => setForm(null)}
          onSave={handleSubmit}
          onFieldChange={updateField}
        />
      )}

      {importPreview && (
        <Modal
          isOpen
          onClose={() => setImportPreview(null)}
          title="ตรวจสอบข้อมูลก่อนนำเข้า"
          size="md"
          closeOnBackdrop={false}
          footer={(
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setImportPreview(null)} disabled={importing}>
                ยกเลิก
              </button>
              <button type="button" className="btn btn-primary" onClick={handleImportConfirm} disabled={importing}>
                {importing ? `กำลังนำเข้า...` : `นำเข้า ${importPreview.length} รายการ`}
              </button>
            </div>
          )}
        >
              <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--tgd-muted-text)' }}>
                พบ {importPreview.length} รายการ — กด "นำเข้า" เพื่อบันทึกเข้าระบบ (รหัสสินค้าซ้ำจะอัปเดตอัตโนมัติ)
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>รหัสสินค้า</th>
                      <th>ชื่อสินค้า</th>
                      <th>หน่วย</th>
                      <th>อุณหภูมิ</th>
                      <th>น้ำหนัก (กก.)</th>
                      <th>Allergen</th>
                      <th>ประเภทสินค้า</th>
                      <th>ประเภท ร.3</th>
                      <th>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--tgd-muted-text)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.customerProductCode}</td>
                        <td>{row.productName}</td>
                        <td>{row.uom || '-'}</td>
                        <td><TempBadge type={row.temperatureType} /></td>
                        <td>{row.packWeightKg ?? '-'}</td>
                        <td>{row.allergenHas ? <span style={{ color: '#ef4444' }}>มี</span> : '-'}</td>
                        <td>{row.productCategory || '-'}</td>
                        <td>
                          {row.r3CarcassTypeCode
                            ? formatR3CarcassType(row.r3CarcassTypeCode, r3Types)
                            : row.r3Raw
                              ? <span style={{ color: 'var(--tgd-danger)' }}>ไม่รู้จัก "{row.r3Raw}" (คงค่าเดิม)</span>
                              : '-'}
                        </td>
                        <td style={{ color: 'var(--tgd-muted-text)' }}>{row.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        </Modal>
      )}
    </section>
  );
}

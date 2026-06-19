import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { getCustomers } from '../../services/masterDataService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import {
  SERVICE_TYPES,
  UNIT_BASIS,
  listProductServiceRates,
  upsertProductServiceRate,
} from '../../services/productServiceRatesService.js';

const EMPTY_FORM = {
  rateId: '',
  serviceType: 'STORAGE',
  rate: '',
  unitBasis: 'PER_KG',
  currency: 'THB',
  note: '',
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
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getCustomers().then((r) => setCustomers(r.data ?? []));
  }, []);

  useEffect(() => {
    setProductId('');
    setProducts([]);
    setRates([]);
    if (!customerId) return;
    listCustomerProducts({ customerId }).then((r) => setProducts(r.data ?? []));
  }, [customerId]);

  useEffect(() => {
    setRates([]);
    if (!productId) return;
    loadRates();
  }, [productId]);

  async function loadRates() {
    if (!productId) return;
    const { data } = await listProductServiceRates(productId);
    setRates(data ?? []);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setError('');
    setSuccess('');
  }

  function openEdit(row) {
    setForm({
      rateId:      row.id,
      serviceType: row.service_type,
      rate:        String(row.rate ?? ''),
      unitBasis:   row.unit_basis,
      currency:    row.currency ?? 'THB',
      note:        row.note ?? '',
    });
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productId) return;
    setSaving(true);
    setError('');
    const result = await upsertProductServiceRate({
      rateId:            form.rateId || null,
      customerProductId: productId,
      serviceType:       form.serviceType,
      rate:              parseFloat(form.rate),
      unitBasis:         form.unitBasis,
      currency:          form.currency || 'THB',
      note:              form.note,
      isActive:          true,
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

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="อัตราค่าบริการตามสินค้า"
        description="กำหนดอัตราค่าบริการแต่ละประเภทตามรายการสินค้าของลูกค้า"
      />

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          ลูกค้า
          <select
            className="form-control"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={{ marginTop: 4, display: 'block', width: '100%' }}
          >
            <option value="">— เลือกลูกค้า —</option>
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
            <option value="">— เลือกสินค้า —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.customer_product_code} — {p.product_name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Product info strip */}
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
          </span>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: 'auto', padding: '6px 16px' }}
            onClick={openCreate}
          >
            + เพิ่มอัตราค่าบริการ
          </button>
        </div>
      )}

      {error && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="banner banner-success" style={{ marginBottom: 12 }}>{success}</div>}

      {/* Rates table */}
      {productId && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['ประเภทค่าบริการ', 'อัตรา', 'หน่วย', 'หมายเหตุ', 'สถานะ', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#374151', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    ยังไม่มีอัตราค่าบริการ — กด "+ เพิ่มอัตราค่าบริการ" เพื่อเริ่มต้น
                  </td>
                </tr>
              ) : rates.map((row) => {
                const ub = UNIT_BASIS.find((u) => u.value === row.unit_basis);
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}><ServiceBadge type={row.service_type} /></td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                      {Number(row.rate).toLocaleString('th-TH', { minimumFractionDigits: 2 })} {row.currency}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#475569' }}>{ub?.label ?? row.unit_basis}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{row.note ?? '-'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: row.is_active ? '#f0fdf4' : '#f1f5f9',
                        color: row.is_active ? '#2d9348' : '#94a3b8',
                      }}>
                        {row.is_active ? 'ใช้งาน' : 'ปิด'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(row)}
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  ประเภทค่าบริการ *
                </label>
                <select
                  className="form-control"
                  value={form.serviceType}
                  onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                  disabled={!!form.rateId}
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label} ({s.labelEn})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  อัตรา (฿) *
                  <input
                    className="form-control"
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

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setForm(null)} disabled={saving}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
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

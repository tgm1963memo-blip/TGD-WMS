import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getCustomers, upsertCustomer } from '../../services/masterDataService.js';

const CUSTOMER_TYPES = ['STANDARD', 'PREMIUM', 'TRIAL'];

const EMPTY_FORM = {
  id: null,
  customerCode: '',
  customerName: '',
  branchType: 'NONE',
  branchName: '',
  customerType: '',
  taxId: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  isActive: true,
  notifyDepositConfirmed: true,
  notifyWithdrawalCompleted: true,
  notifyInvoiceApproved: true,
};

function generateCode(existingCustomers) {
  const nums = existingCustomers
    .map((c) => c.customer_code ?? '')
    .map((code) => parseInt(code.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n) && n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return 'C' + String(next).padStart(3, '0');
}

function CustomerFormModal({ initial, existingCustomers, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleTaxIdBlur() {
    let digits = form.taxId.replace(/\D/g, '');
    if (digits.length === 13) {
      set('taxId', `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12, 13)}`);
    } else if (digits.length > 0) {
      // Just set digits if they didn't finish typing
      set('taxId', digits);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customerCode.trim() || !form.customerName.trim()) {
      setError('กรุณากรอกรหัสลูกค้าและชื่อลูกค้า');
      return;
    }
    setSaving(true);
    setError('');

    let finalName = form.customerName.trim();
    if (form.branchType === 'HEAD_OFFICE') {
      finalName += ' (สำนักงานใหญ่)';
    } else if (form.branchType === 'BRANCH' && form.branchName.trim()) {
      finalName += ` (สาขา ${form.branchName.trim()})`;
    }

    const submitForm = {
      ...form,
      customerName: finalName,
    };

    const { data, error: err } = await upsertCustomer(submitForm);
    setSaving(false);
    if (err) {
      setError(err.message ?? 'บันทึกไม่สำเร็จ');
      return;
    }
    onSave(data);
  }

  const isEdit = !!form.id;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '28px 28px 24px',
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 12px 48px rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111827', fontWeight: 700 }}>
            {isEdit ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
          </h2>
          <button type="button" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }} onClick={onClose}>×</button>
        </div>

        {error ? <div className="banner banner-danger" role="alert" style={{ marginBottom: 14 }}>{error}</div> : null}

        <form className="form-card" onSubmit={handleSubmit} style={{ padding: 0, border: 'none', boxShadow: 'none' }}>
          <div className="form-grid">
            <label className="form-field">
              <span>
                รหัสลูกค้า <span className="field-required">*</span>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="form-control"
                  type="text"
                  value={form.customerCode}
                  onChange={(e) => set('customerCode', e.target.value)}
                  placeholder="เช่น C001"
                  disabled={isEdit}
                  style={{ flex: 1 }}
                />
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => set('customerCode', generateCode(existingCustomers ?? []))}
                    style={{
                      flexShrink: 0,
                      padding: '0 12px',
                      border: '1px solid #2563eb',
                      borderRadius: 8,
                      background: '#eff6ff',
                      color: '#2563eb',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Auto
                  </button>
                )}
              </div>
            </label>
            <label className="form-field">
              <span>ประเภทลูกค้า</span>
              <select className="form-control" value={form.customerType} onChange={(e) => set('customerType', e.target.value)}>
                <option value="">-- ไม่ระบุ --</option>
                {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>
                ชื่อลูกค้า <span className="field-required">*</span>
              </span>
              <input
                className="form-control"
                type="text"
                value={form.customerName}
                onChange={(e) => set('customerName', e.target.value)}
                placeholder="ชื่อบริษัท / ชื่อลูกค้า"
              />
            </label>

            <div className="form-field">
              <span>สาขา / สำนักงานใหญ่</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className="form-control"
                  value={form.branchType}
                  onChange={(e) => set('branchType', e.target.value)}
                  style={{ flex: form.branchType === 'BRANCH' ? '0 0 140px' : '1' }}
                >
                  <option value="NONE">-- ไม่ระบุ --</option>
                  <option value="HEAD_OFFICE">สำนักงานใหญ่</option>
                  <option value="BRANCH">สาขา</option>
                </select>
                {form.branchType === 'BRANCH' && (
                  <input
                    className="form-control"
                    type="text"
                    value={form.branchName}
                    onChange={(e) => set('branchName', e.target.value)}
                    placeholder="ระบุสาขา"
                    style={{ flex: 1 }}
                  />
                )}
              </div>
            </div>
            <label className="form-field">
              <span>เลขประจำตัวผู้เสียภาษี</span>
              <input className="form-control" type="text" value={form.taxId} onChange={(e) => set('taxId', e.target.value)} onBlur={handleTaxIdBlur} placeholder="กรอกตัวเลขเรียงติดกัน" />
            </label>
            <label className="form-field">
              <span>ชื่อผู้ติดต่อ</span>
              <input className="form-control" type="text" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </label>
            <label className="form-field">
              <span>โทรศัพท์</span>
              <input className="form-control" type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
            <label className="form-field">
              <span>อีเมล</span>
              <input className="form-control" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>

            <label className="form-field form-field-span-2">
              <span>ที่อยู่</span>
              <textarea
                className="form-control"
                rows={3}
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </label>
          </div>

          {isEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, marginBottom: 8, paddingRight: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                  style={{ width: 24, height: 24, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  ใช้งานอยู่
                  <span style={{fontSize: 12, color: '#6b7280'}}>(Active)</span>
                </span>
              </label>
            </div>
          )}

          <div style={{ borderTop: '1px dashed #e5e7eb', margin: '4px 0 14px', paddingTop: 14 }} data-testid="customer-notification-settings-section">
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>
              การแจ้งเตือนทางอีเมล
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  data-testid="customer-notify-deposit-confirmed-checkbox"
                  checked={form.notifyDepositConfirmed}
                  onChange={(e) => set('notifyDepositConfirmed', e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                  ยืนยันรับสินค้าเข้าคลัง
                  <span style={{ fontSize: 11, color: '#6b7280' }}>เมื่อรับฝากสินค้าเข้าคลังยืนยันแล้ว</span>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  data-testid="customer-notify-withdrawal-completed-checkbox"
                  checked={form.notifyWithdrawalCompleted}
                  onChange={(e) => set('notifyWithdrawalCompleted', e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                  เบิกสินค้า/จัดส่งสำเร็จ
                  <span style={{ fontSize: 11, color: '#6b7280' }}>เมื่อคำขอเบิกสินค้าถูกส่งออกจากคลังแล้ว</span>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  data-testid="customer-notify-invoice-approved-checkbox"
                  checked={form.notifyInvoiceApproved}
                  onChange={(e) => set('notifyInvoiceApproved', e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                  ใบแจ้งหนี้พร้อมแล้ว
                  <span style={{ fontSize: 11, color: '#6b7280' }}>เมื่อใบแจ้งหนี้ได้รับการอนุมัติแล้ว</span>
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    getCustomers().then(({ data, error: err }) => {
      setCustomers(data ?? []);
      setError(err);
      setLoading(false);
    });
  }

  function openCreate() {
    setModal({ ...EMPTY_FORM });
  }

  function openEdit(customer) {
    let baseName = customer.customer_name ?? '';
    let bType = 'NONE';
    let bName = '';
    
    if (baseName.endsWith(' (สำนักงานใหญ่)')) {
      bType = 'HEAD_OFFICE';
      baseName = baseName.replace(' (สำนักงานใหญ่)', '');
    } else if (baseName.match(/ \(สาขา (.*?)\)$/)) {
      bType = 'BRANCH';
      bName = baseName.match(/ \(สาขา (.*?)\)$/)[1];
      baseName = baseName.replace(/ \(สาขา .*?\)$/, '');
    }

    setModal({
      id: customer.id,
      customerCode: customer.customer_code ?? '',
      customerName: baseName,
      branchType: bType,
      branchName: bName,
      customerType: customer.customer_type ?? '',
      taxId: customer.tax_id ?? '',
      contactName: customer.contact_name ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      isActive: customer.is_active ?? true,
      notifyDepositConfirmed: customer.notify_deposit_confirmed ?? true,
      notifyWithdrawalCompleted: customer.notify_withdrawal_completed ?? true,
      notifyInvoiceApproved: customer.notify_invoice_approved ?? true,
    });
  }

  function handleSaved(saved) {
    setModal(null);
    load();
  }

  const filtered = customers.filter((c) => {
    const matchSearch = !search ||
      (c.customer_code ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.customer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchActive =
      filterActive === 'all' ||
      (filterActive === 'active' && c.is_active) ||
      (filterActive === 'inactive' && !c.is_active);
    return matchSearch && matchActive;
  });

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="ข้อมูลลูกค้า"
        description="ตั้งค่าและจัดการข้อมูลลูกค้าที่ใช้บริการห้องเย็น"
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          className="form-control"
          type="search"
          placeholder="ค้นหารหัส / ชื่อ / อีเมล..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', maxWidth: 340 }}
        />
        <select
          className="form-control"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้งานอยู่</option>
          <option value="inactive">ปิดใช้งาน</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          + เพิ่มลูกค้าใหม่
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="banner banner-danger" role="alert">{error.message ?? 'โหลดข้อมูลไม่สำเร็จ'}</div>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--tgd-muted-text)' }}>ไม่พบข้อมูลลูกค้าที่ตรงกับเงื่อนไข</p>
      ) : (
        <div className="responsive-table">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อลูกค้า</th>
                <th>ประเภท</th>
                <th>ผู้ติดต่อ</th>
                <th>โทรศัพท์</th>
                <th>อีเมล</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.customer_code}</td>
                  <td>{c.customer_name}</td>
                  <td>{c.customer_type ?? '-'}</td>
                  <td>{c.contact_name ?? '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.phone ?? '-'}</td>
                  <td>{c.email ?? '-'}</td>
                  <td><StatusBadge value={c.is_active} /></td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openEdit(c)}
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: 'var(--tgd-muted-text)', fontSize: 12, marginTop: 8 }}>
            แสดง {filtered.length} จาก {customers.length} ลูกค้า
          </p>
        </div>
      )}

      {modal !== null && (
        <CustomerFormModal
          initial={modal}
          existingCustomers={customers}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}

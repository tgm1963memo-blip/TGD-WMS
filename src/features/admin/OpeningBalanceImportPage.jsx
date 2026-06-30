import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ExcelImportExportToolbar } from '../../components/customer/ExcelImportExportToolbar.jsx';
import { getCustomers } from '../../services/masterDataService.js';
import { importOpeningBalance } from '../../services/openingBalanceImportService.js';
import { downloadOpeningBalanceTemplate, parseOpeningBalanceFile } from '../../utils/openingBalanceExcelUtils.js';
import { useAuth } from '../auth/AuthContext.jsx';

export function OpeningBalanceImportPage() {
  const { session } = useAuth();
  const actorId = session?.user?.id ?? null;

  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [previewRows, setPreviewRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getCustomers({ isActive: true }).then(({ data }) => setCustomers(data ?? []));
  }, []);

  async function handleImportFile(file) {
    setResult(null);
    const { rows, errors } = await parseOpeningBalanceFile(file);
    setPreviewRows(rows);
    setParseErrors(errors);
  }

  async function handleImport() {
    if (!customerId) { alert('กรุณาเลือกลูกค้าก่อน'); return; }
    if (!previewRows.length) { alert('ไม่มีข้อมูลที่จะ import'); return; }
    if (!actorId) { alert('ไม่พบข้อมูล user กรุณา login ใหม่'); return; }

    setImporting(true);
    setResult(null);
    const { data, error } = await importOpeningBalance(customerId, previewRows, actorId);
    setImporting(false);

    if (error) {
      setResult({ type: 'error', message: error.message ?? 'เกิดข้อผิดพลาด' });
      return;
    }

    setResult({ type: 'success', data });
    if (data?.processed > 0) {
      setPreviewRows([]);
      setParseErrors([]);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <section className="page-shell">
      <PageHeader
        title="นำเข้ายอดสินค้าเริ่มต้น (Opening Balance Import)"
        description="Import สินค้า + Lot + Location + จำนวน ผ่าน Excel เพื่อตั้งต้นสต็อกในระบบ"
      />

      {/* Step 1 — Download template */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>ขั้นตอนที่ 1 — ดาวน์โหลด Template และกรอกข้อมูล</h3>
        <p style={{ fontSize: 13, color: 'var(--tgd-text-secondary)', marginBottom: 12 }}>
          กรอกข้อมูลในไฟล์ Excel ตาม template คอลัมน์ที่จำเป็น: <strong>customer_product_code, location_code, qty_boxes</strong>
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => downloadOpeningBalanceTemplate()}
            type="button"
          >
            ดาวน์โหลด Template (.xlsx)
          </button>
        </div>

        <table style={{ marginTop: 16, fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--tgd-surface-2, #f5f5f5)' }}>
              {['คอลัมน์', 'ความหมาย', 'จำเป็น', 'ตัวอย่าง'].map((h) => (
                <th key={h} style={{ padding: '6px 10px', border: '1px solid var(--tgd-border)', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['customer_product_code', 'รหัสสินค้าของลูกค้า', '✓', '10154-10'],
              ['product_name', 'ชื่อสินค้า', '', 'หมูสามชั้นแช่แข็ง'],
              ['lot_no', 'Lot Number', '', 'LOT-2025-001'],
              ['mfg_date', 'วันผลิต (YYYY-MM-DD)', '', '2025-01-15'],
              ['expiry_date', 'วันหมดอายุ (YYYY-MM-DD)', '', '2026-01-15'],
              ['location_code', 'รหัส Location', '✓', 'A-L-01-1'],
              ['qty_boxes', 'จำนวน (ลัง)', '✓', '100'],
              ['weight_kg', 'น้ำหนัก (กก.)', '', '500'],
            ].map(([col, desc, req, ex]) => (
              <tr key={col}>
                <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', fontFamily: 'monospace' }}>{col}</td>
                <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)' }}>{desc}</td>
                <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', textAlign: 'center', color: req ? '#dc2626' : '#888' }}>{req || '-'}</td>
                <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', color: '#555' }}>{ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Step 2 — Select customer + upload file */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 15 }}>ขั้นตอนที่ 2 — เลือกลูกค้าและอัปโหลดไฟล์</h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>ลูกค้า <span style={{ color: '#dc2626' }}>*</span></label>
            <select
              className="form-input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={{ minWidth: 300 }}
            >
              <option value="">-- เลือกลูกค้า --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_name ?? c.customer_code ?? c.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ExcelImportExportToolbar
          onTemplate={() => downloadOpeningBalanceTemplate()}
          onImportFile={handleImportFile}
          exportTestId="ob-export"
          templateTestId="ob-template"
          importTestId="ob-import"
        />

        {parseErrors.length > 0 && (
          <div className="banner banner-danger" style={{ marginTop: 12 }}>
            <strong>ข้อผิดพลาดในไฟล์:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Step 3 — Preview + confirm */}
      {previewRows.length > 0 && (
        <div className="section-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8, fontSize: 15 }}>
            ขั้นตอนที่ 3 — ตรวจสอบข้อมูลและยืนยัน Import
          </h3>
          {selectedCustomer && (
            <p style={{ fontSize: 13, color: 'var(--tgd-text-secondary)', marginBottom: 12 }}>
              ลูกค้า: <strong>{selectedCustomer.customer_name ?? selectedCustomer.customer_code}</strong> · {previewRows.length} รายการ
            </p>
          )}

          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--tgd-surface-2, #f5f5f5)' }}>
                  {['#', 'รหัสสินค้า', 'ชื่อสินค้า', 'Lot No', 'วันผลิต', 'วันหมดอายุ', 'Location', 'ลัง', 'น้ำหนัก (กก.)'].map((h) => (
                    <th key={h} style={{ padding: '6px 10px', border: '1px solid var(--tgd-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--tgd-surface-2, #fafafa)' }}>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', fontFamily: 'monospace' }}>{row.customer_product_code}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)' }}>{row.product_name}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)' }}>{row.lot_no ?? '-'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)' }}>{row.mfg_date ?? '-'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)' }}>{row.expiry_date ?? '-'}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', fontFamily: 'monospace' }}>{row.location_code}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', textAlign: 'right' }}>{row.qty_boxes}</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--tgd-border)', textAlign: 'right' }}>{row.weight_kg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importing ? (
            <LoadingState message="กำลัง import ข้อมูล..." />
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!customerId || importing}
              type="button"
            >
              ยืนยัน Import {previewRows.length} รายการ
            </button>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`banner ${result.type === 'success' ? 'banner-success' : 'banner-danger'}`} style={{ marginTop: 8 }}>
          {result.type === 'error' ? (
            <span>เกิดข้อผิดพลาด: {result.message}</span>
          ) : (
            <div>
              <strong>Import สำเร็จ {result.data?.processed ?? 0} รายการ</strong>
              {result.data?.errors?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>ข้อผิดพลาดระหว่าง import:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {result.data.errors.map((e, i) => (
                      <li key={i}>แถว {e.row}: {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

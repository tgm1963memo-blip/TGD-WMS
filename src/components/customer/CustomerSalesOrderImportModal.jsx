import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal.jsx';
import {
  readSalesOrderExcelFile,
  parseSalesOrderRows,
} from '../../utils/customerSalesOrderImportUtils.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import {
  createCustomerWithdrawalRequest,
  upsertCustomerWithdrawalRequestLine,
} from '../../services/customerWithdrawalRequestService.js';

// Bulk-import a customer's own ERP-exported "ใบส่งสินค้า" file into one
// withdrawal request PER DEBTOR GROUP found in the file — see
// customerSalesOrderImportUtils.js for the parsing/aggregation rules and
// the plan notes behind this feature (2026-07-27 session: bulk warehouse
// pick, then sort per destination outside afterward). Per the explicit
// decision this import blocks entirely on any unmatched product code —
// no partial/silent creation.
export function CustomerSalesOrderImportModal({ isOpen, onClose, customerId, onImported }) {
  const [step, setStep] = useState('upload'); // upload | preview | submitting | done
  const [fileName, setFileName] = useState('');
  const [groups, setGroups] = useState([]);
  const [unmatchedCodes, setUnmatchedCodes] = useState([]);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  function reset() {
    setStep('upload');
    setFileName('');
    setGroups([]);
    setUnmatchedCodes([]);
    setError('');
    setResults([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    try {
      const [rawRows, catalogResult] = await Promise.all([
        readSalesOrderExcelFile(file),
        listCustomerProducts({ customerId }),
      ]);
      if (catalogResult.error) {
        setError(catalogResult.error.message);
        return;
      }
      const { groups: parsedGroups, unmatchedCodes: unmatched } = parseSalesOrderRows(rawRows, catalogResult.data ?? []);
      if (parsedGroups.length === 0) {
        setError('ไม่พบรายการสินค้าในไฟล์นี้ — ตรวจสอบว่าเป็นไฟล์รูปแบบ "ใบส่งสินค้า" ที่ถูกต้อง');
        return;
      }
      setGroups(parsedGroups);
      setUnmatchedCodes(unmatched);
      setStep('preview');
    } catch (err) {
      setError(err.message ?? 'ไม่สามารถอ่านไฟล์นี้ได้');
    }
  }

  async function handleSubmit() {
    setStep('submitting');
    setError('');
    const createResults = [];

    for (const group of groups) {
      // Left as WITHDRAWAL_DRAFT, not auto-submitted — the file has no
      // pickup contact, vehicle, or delivery-type preference to go on, so
      // the customer reviews/fills those in via the normal edit flow
      // before submitting each request themselves.
      // eslint-disable-next-line no-await-in-loop
      const createResult = await createCustomerWithdrawalRequest({
        requestedDispatchDate: group.date,
        deliveryType: 'DELIVERY',
        pickupContact: group.debtorName,
        destination: group.debtorName,
        note: `นำเข้าจากไฟล์ Sales Order — เลขที่: ${group.soNumbers.join(', ')}`,
        customerId,
      });
      if (createResult.error) {
        createResults.push({ debtorName: group.debtorName, error: createResult.error.message });
        continue;
      }
      const requestId = createResult.data?.id;
      const lineErrors = [];
      for (const product of group.products) {
        // eslint-disable-next-line no-await-in-loop
        const lineResult = await upsertCustomerWithdrawalRequestLine(requestId, {
          customerProductCode: product.productCode,
          productName: product.matchedProductName ?? product.productName,
          requestedBoxes: product.requestedBoxes,
          requestedWeight: product.requestedWeight,
          pickingRule: 'FEFO',
        });
        if (lineResult.error) lineErrors.push(`${product.productCode}: ${lineResult.error.message}`);
      }
      createResults.push({
        debtorName: group.debtorName,
        requestId,
        requestNo: createResult.data?.withdrawal_no ?? createResult.data?.request_no,
        lineErrors,
      });
    }

    setResults(createResults);
    setStep('done');
  }

  function handleFinish() {
    onImported?.();
    handleClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" title="นำเข้าจากไฟล์ Sales Order">
      {step === 'upload' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--tgd-muted-text)', marginBottom: 12 }}>
            อัปโหลดไฟล์ใบส่งสินค้าจากระบบของท่าน ระบบจะรวมจำนวนสินค้าตามรหัสลูกหนี้ในไฟล์
            และสร้างใบเบิก (ร่าง) แยกตามกลุ่มลูกค้า 1 ใบต่อกลุ่ม — ท่านตรวจสอบและกรอกข้อมูลเพิ่มก่อนส่งใบเบิกแต่ละใบเองอีกครั้ง
          </p>
          <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} data-testid="sales-order-import-file-input" />
          {error ? <div className="banner banner-danger" role="alert" style={{ marginTop: 12 }}>{error}</div> : null}
        </div>
      )}

      {step === 'preview' && (
        <div>
          <p style={{ fontSize: 13, marginBottom: 8 }}>ไฟล์: <strong>{fileName}</strong> — พบ {groups.length} กลุ่มลูกค้า</p>
          {unmatchedCodes.length > 0 ? (
            <div className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>
              พบรหัสสินค้า {unmatchedCodes.length} รายการที่ไม่ตรงกับแคตตาล็อกของท่าน กรุณาแก้ไขรหัสในไฟล์ต้นทางแล้วอัปโหลดใหม่ก่อนดำเนินการต่อ:
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {unmatchedCodes.map((code) => <li key={code}>{code}</li>)}
              </ul>
            </div>
          ) : null}

          {groups.map((group) => (
            <div key={`${group.debtorCode}|${group.debtorName}`} className="table-card" style={{ marginBottom: 12 }}>
              <div className="table-card-header">
                <h3 style={{ fontSize: 14 }}>{group.debtorName} ({group.debtorCode})</h3>
                <span style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>{group.soNumbers.length} SO</span>
              </div>
              <div className="table-responsive">
                <table className="tgd-table">
                  <thead>
                    <tr>
                      <th>รหัสสินค้า</th>
                      <th>ชื่อสินค้า (แคตตาล็อก)</th>
                      <th>จำนวน</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.products.map((p) => (
                      <tr key={p.productCode} style={!p.matched ? { background: '#fef2f2' } : undefined}>
                        <td>{p.productCode}</td>
                        <td>{p.matchedProductName ?? '-'}</td>
                        <td>{p.requestedBoxes ?? p.requestedWeight ?? p.qty} {p.requestedWeight != null ? 'กก.' : 'กล่อง'}</td>
                        <td style={{ color: p.matched ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {p.matched ? 'ตรงกับแคตตาล็อก' : 'ไม่พบในแคตตาล็อก'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}

          <div className="action-row">
            <button className="btn btn-secondary" type="button" onClick={reset}>เลือกไฟล์ใหม่</button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={unmatchedCodes.length > 0}
              onClick={handleSubmit}
            >
              สร้างใบเบิก {groups.length} ใบ
            </button>
          </div>
        </div>
      )}

      {step === 'submitting' && <p>กำลังสร้างใบเบิก...</p>}

      {step === 'done' && (
        <div>
          <div className="alert-success-panel" role="status" style={{ marginBottom: 12 }}>
            สร้างใบเบิกร่าง (draft) แล้ว {results.filter((r) => !r.error).length} จาก {results.length} รายการ —
            กรุณาตรวจสอบและกรอกข้อมูลผู้ติดต่อ/รถขนส่งให้ครบก่อนส่งใบเบิกแต่ละใบ
          </div>
          <ul style={{ paddingLeft: 20 }}>
            {results.map((r) => (
              <li key={r.debtorName}>
                {r.debtorName}: {r.error ? `ล้มเหลว — ${r.error}` : (
                  <>
                    สร้างใบเบิก {r.requestNo ?? ''} สำเร็จ{' '}
                    {r.requestId && (
                      <Link to={`/customer/withdrawal-request/new?editId=${r.requestId}`}>ตรวจสอบและส่ง</Link>
                    )}
                  </>
                )}
                {r.lineErrors?.length > 0 && (
                  <span style={{ color: '#dc2626' }}> (มีรายการที่บันทึกไม่สำเร็จ {r.lineErrors.length} รายการ)</span>
                )}
              </li>
            ))}
          </ul>
          <div className="action-row">
            <button className="btn btn-primary" type="button" onClick={handleFinish}>ปิด</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

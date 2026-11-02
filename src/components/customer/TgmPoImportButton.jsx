import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { mapTgmPoRowsToDepositLines, parseTgmPoFile } from '../../utils/tgmPoImportUtils.js';

const STATUS_BADGE = {
  ok: { className: 'status-badge status-badge--confirmed', label: 'พร้อมเติม' },
  warn: { className: 'status-badge status-badge--hold', label: 'เติมได้ — ตรวจเพิ่ม' },
  skip: { className: 'status-badge status-badge--blocked', label: 'ข้าม' },
};

function formatKg(value) {
  return value == null ? '-' : Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatIsoDate(iso) {
  const match = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

// TGM-only: reads the B-Plus PO export, shows what will be filled (lot =
// "Lot <day of year> Sup <sup code>") and only replaces the lines once the
// user confirms. See tgmPoImportUtils.js.
export function TgmPoImportButton({ catalogProducts, startKey, disabled = false, onApply, onError }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    onError('');
    try {
      const { rows, errors } = await parseTgmPoFile(file);
      if (errors.length) {
        onError(errors.join(' '));
        return;
      }
      const mapped = mapTgmPoRowsToDepositLines(rows, catalogProducts, startKey);
      if (!mapped.preview.length) {
        onError('ไม่พบรายการสินค้าในไฟล์ PO');
        return;
      }
      setFileName(file.name);
      setResult(mapped);
    } catch (err) {
      onError(err?.message ?? 'อ่านไฟล์ PO ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setResult(null);
  }

  function apply() {
    const skipped = result.preview.filter((entry) => entry.status === 'skip');
    const warned = result.preview.filter((entry) => entry.status === 'warn');
    const poNos = [...new Set(result.preview.map((entry) => entry.poNo).filter(Boolean))];
    const parts = [`เติม ${result.lines.length} รายการจาก PO ${poNos.join(', ') || fileName}`];
    if (skipped.length) parts.push(`ข้าม ${skipped.length} แถว: ${skipped.map((e) => `แถว ${e.row} ${e.sku} — ${e.messages.join(', ')}`).join('; ')}`);
    if (warned.length) parts.push(`ตรวจเพิ่ม ${warned.length} รายการ: ${warned.map((e) => `${e.sku} — ${e.messages.join(', ')}`).join('; ')}`);
    onApply(result.lines, parts.join(' · '));
    close();
  }

  const preview = result?.preview ?? [];
  const first = preview[0];
  const usableCount = result?.lines.length ?? 0;

  return (
    <>
      <label className="btn btn-primary csv-import-button" data-testid="tgm-po-import-button">
        {busy ? 'กำลังอ่าน PO…' : 'อัปโหลด PO (TGM)'}
        <input
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          data-testid="tgm-po-import-input"
          disabled={disabled || busy}
          hidden
          onChange={handleFile}
          type="file"
        />
      </label>

      <Modal
        isOpen={Boolean(result)}
        onClose={close}
        size="lg"
        title="ตรวจสอบข้อมูลจาก PO ก่อนเติมลงใบฝาก"
        closeOnBackdrop={false}
        footer={(
          <div className="action-row" style={{ justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: 13 }}>เติมได้ {usableCount} รายการ · ข้าม {preview.length - usableCount}</span>
            <div className="action-row">
              <button className="btn btn-secondary" onClick={close} type="button">ยกเลิก</button>
              <button className="btn btn-primary" data-testid="tgm-po-import-apply" disabled={!usableCount} onClick={apply} type="button">
                เติมลงใบฝาก
              </button>
            </div>
          </div>
        )}
      >
        {first ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 13 }}>
              <span>ไฟล์ <b>{fileName}</b></span>
              <span>เลขที่ PO <b>{first.poNo || '-'}</b></span>
              <span>ผู้ขาย (AP_CODE) <b>{first.apCode || '-'}</b></span>
              <span>วันที่ส่ง <b>{formatIsoDate(first.shipDate)}</b></span>
            </div>
            <div className="banner banner-info" style={{ margin: 0 }}>
              Lot = Lot + ลำดับวันในปีของวันที่ส่ง + Sup + รหัส sup ของผู้ขาย เช่น 02/11/2026 → Lot 306 Sup 39
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" data-testid="tgm-po-import-preview">
                <thead>
                  <tr>
                    <th>แถว</th>
                    <th>SKU_CODE</th>
                    <th>ชื่อสินค้า (แคตตาล็อก)</th>
                    <th style={{ textAlign: 'right' }}>จำนวน (KG)</th>
                    <th style={{ textAlign: 'right' }}>กก./กล่อง</th>
                    <th style={{ textAlign: 'right' }}>กล่อง</th>
                    <th>Lot</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((entry) => {
                    const badge = STATUS_BADGE[entry.status];
                    return (
                      <tr key={entry.row}>
                        <td>{entry.row}</td>
                        <td>{entry.sku || '-'}</td>
                        <td>{entry.productName || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{formatKg(entry.qtyKg)}</td>
                        <td style={{ textAlign: 'right' }}>{entry.weightPerBox || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{entry.boxes || '-'}</td>
                        <td>{entry.status === 'skip' ? '-' : entry.lot}</td>
                        <td>
                          <span className={badge.className}>{badge.label}</span>
                          {entry.messages.length ? (
                            <div style={{ fontSize: 12, marginTop: 2, whiteSpace: 'normal' }}>{entry.messages.join(' · ')}</div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

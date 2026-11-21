import { useState } from 'react';
import { getBillingStatementExportData } from '../../services/billingStatementExportService.js';
import {
  buildBillingStatementModel, buildOvertimeStatementModel, STATEMENT_THEME,
} from '../../utils/billingStatementModel.js';
import {
  buildBillingStatementWorkbook, buildOvertimeStatementWorkbook, billingStatementFileName,
  overtimeStatementFileName, downloadWorkbook,
} from '../../utils/billingStatementExcel.js';
import { TGM_CUSTOMER_CODES } from '../../utils/tgmPoImportUtils.js';

const THEME_OPTIONS = [
  { value: STATEMENT_THEME.NAVY, label: 'แบบหัวตารางน้ำเงินเข้ม (OVO / THAIMAX)' },
  { value: STATEMENT_THEME.LIGHT, label: 'แบบฟ้าอ่อน (TGM)' },
];

const money = (value) => Number(value ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function defaultStatementTheme(customerCode) {
  return TGM_CUSTOMER_CODES.includes(customerCode) ? STATEMENT_THEME.LIGHT : STATEMENT_THEME.NAVY;
}

// Exports the customer-format Excel statement (and the separate OT report)
// for one customer + period + scope. The figures are always worked out fresh
// from the rate engine, so `savedTotal` (a stored draft's total, when this is
// opened from one) is compared against them and any gap is shown rather than
// hidden -- the file still downloads either way.
export function BillingStatementExportBar({
  customerId, customerCode, periodStart, periodEnd, temperatureType = null, productCategory = null,
  savedTotal = null, disabled = false,
}) {
  const [themeChoice, setThemeChoice] = useState(null);
  const [busy, setBusy] = useState(null); // 'statement' | 'overtime' | null
  const [error, setError] = useState('');
  const [notes, setNotes] = useState([]);
  const theme = themeChoice ?? defaultStatementTheme(customerCode);
  const ready = Boolean(customerId && periodStart && periodEnd);

  async function load({ includeAttachments }) {
    const result = await getBillingStatementExportData({
      customerId, periodStart, periodEnd, temperatureType, productCategory, includeAttachments,
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function run(kind, task) {
    setBusy(kind);
    setError('');
    setNotes([]);
    try {
      setNotes(await task());
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  const exportStatement = () => run('statement', async () => {
    const data = await load({ includeAttachments: true });
    const model = buildBillingStatementModel({
      preview: data.preview, customer: data.customer, periodStart, periodEnd, productCategory, temperatureType,
    });
    if (model.isEmpty) throw new Error('ไม่มีรายการค่าบริการในช่วงเวลานี้ จึงไม่มีข้อมูลให้ export');

    const workbook = await buildBillingStatementWorkbook(model, { theme, attachments: data.attachments });
    await downloadWorkbook(workbook, billingStatementFileName(model));

    const found = [];
    for (const r of model.reconciliation) {
      if (r.diff !== 0) {
        found.push(`${r.label}: ยอดตามสูตรใน Excel ${money(r.sheetTotal)} บาท ต่างจากยอดที่ระบบคิด ${money(r.engineTotal)} บาท (${r.diff > 0 ? '+' : ''}${money(r.diff)}) จากการปัดเศษต่อแถว`);
      }
    }
    if (savedTotal != null && Math.abs(Number(savedTotal) - model.engineGrandTotal) >= 0.005) {
      found.push(`ยอดที่คำนวณใหม่ ${money(model.engineGrandTotal)} บาท ไม่ตรงกับยอดที่บันทึกในร่างนี้ ${money(savedTotal)} บาท — ข้อมูลหรืออัตราอาจเปลี่ยนหลังสร้างร่าง หรือร่างนี้สร้างแบบงวดอัตโนมัติต่อล็อต`);
    }
    for (const warning of data.attachmentWarnings ?? []) found.push(`ไม่ได้แนบ sheet ${warning}`);
    return found;
  });

  const exportOvertime = () => run('overtime', async () => {
    const data = await load({ includeAttachments: false });
    const model = buildOvertimeStatementModel({
      overtimePoolLines: data.preview.overtimePoolLines, customer: data.customer, periodStart, periodEnd,
    });
    if (model.isEmpty) throw new Error('ไม่มีรายการค่าล่วงเวลา (OT) ในช่วงเวลานี้');
    const workbook = await buildOvertimeStatementWorkbook(model);
    await downloadWorkbook(workbook, overtimeStatementFileName(model));
    return [];
  });

  return (
    <div data-testid="billing-statement-export-bar">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <label htmlFor="billing-statement-theme" style={{ fontSize: 13 }}>รูปแบบ Excel</label>
        <select
          id="billing-statement-theme"
          className="form-control"
          style={{ width: 'auto' }}
          value={theme}
          onChange={(event) => setThemeChoice(event.target.value)}
          data-testid="billing-statement-theme-select"
        >
          {THEME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button
          type="button"
          className="btn btn-outline"
          onClick={exportStatement}
          disabled={disabled || !ready || busy != null}
          data-testid="billing-statement-export-button"
        >
          {busy === 'statement' ? 'กำลังสร้าง Excel...' : 'Export Excel ตามแบบลูกค้า'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={exportOvertime}
          disabled={disabled || !ready || busy != null}
          data-testid="billing-statement-export-ot-button"
        >
          {busy === 'overtime' ? 'กำลังสร้าง Excel...' : 'Export รายงาน OT'}
        </button>
      </div>
      {error ? (
        <div className="banner banner-danger" style={{ marginTop: 8 }} data-testid="billing-statement-export-error">{error}</div>
      ) : null}
      {notes.length > 0 ? (
        <div className="banner banner-warning" style={{ marginTop: 8 }} data-testid="billing-statement-export-notes">
          <strong>ดาวน์โหลดแล้ว — มีข้อสังเกต:</strong>
          <ul style={{ margin: '4px 0 0 18px' }}>
            {notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

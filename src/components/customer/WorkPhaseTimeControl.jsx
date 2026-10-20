import { useEffect, useState } from 'react';
import { listAllProductServiceRates } from '../../services/productServiceRatesService.js';
import { computeOvertimePoolLines } from '../../utils/billingRateCalc.js';
import { listOvertimeFlaggedDocuments } from '../../services/billingRateEngineService.js';
import {
  combineDateAndEditedTime,
  formatDateYYYYMMDD,
  formatTimeHHmm,
} from '../../utils/workTimerUtils.js';

// Both controls below render as plain `.form-grid` cells (label + value,
// same shape as "ทะเบียนรถ" etc.) rather than their own bordered panel —
// editing controls only appear in a small popover on demand. This is a
// compact redesign of what used to be a large separate "เวลาปฏิบัติงาน"
// card: admin feedback was that the card floated oddly below the header
// and took up too much space for documents that hadn't recorded anything
// yet, so both callers now render these directly inside their existing
// "Header info" form-grid instead of in a section of their own.
function CompactFieldCell({ label, valueNode, byline, canWrite, editing, onToggleEdit, children }) {
  return (
    <div>
      <div className="form-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 }}>
        <span>{valueNode}</span>
        {canWrite && (
          <button
            type="button"
            onClick={onToggleEdit}
            aria-label={`แก้ไข${label}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}
          >
            ✏️
          </button>
        )}
      </div>
      {byline && <div style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>{byline}</div>}
      {editing && (
        <div style={{
          marginTop: 6, background: '#fff', border: '1px dashed var(--tgd-border, #e2e8f0)',
          borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 190,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Shared by CustomerDepositDetailModal and CustomerAdminWithdrawalReviewPage
// for the receiving/dispatch start-finish times — each cell offers both a
// one-click "เวลาปัจจุบัน" stamp and a date+time edit for after-the-fact
// corrections (unlike Scan Center, which only needs self-correction, admin
// also needs to be able to record a time nobody tapped live for).
export function WorkPhaseTimeControl({
  canWrite,
  startedLabel,
  finishedLabel,
  startedAt,
  startedByEmail,
  finishedAt,
  finishedByEmail,
  onRecordStart,
  onRecordFinish,
  onEditStart,
  onEditFinish,
  fallbackDate,
}) {
  return (
    <>
      <PhaseRow
        label={startedLabel}
        at={startedAt}
        byEmail={startedByEmail}
        canWrite={canWrite}
        onRecordNow={onRecordStart}
        onEditSave={onEditStart}
        fallbackDate={fallbackDate}
      />
      <PhaseRow
        label={finishedLabel}
        at={finishedAt}
        byEmail={finishedByEmail}
        canWrite={canWrite}
        onRecordNow={onRecordFinish}
        onEditSave={onEditFinish}
        fallbackDate={fallbackDate}
      />
    </>
  );
}

function PhaseRow({ label, at, byEmail, canWrite, onRecordNow, onEditSave, fallbackDate }) {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  function openEdit() {
    setEditDate(formatDateYYYYMMDD(at) ?? formatDateYYYYMMDD(fallbackDate) ?? formatDateYYYYMMDD(new Date()) ?? '');
    setEditValue(formatTimeHHmm(at) ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    const iso = combineDateAndEditedTime(editDate, editValue);
    if (!iso) return;
    setBusy(true);
    await onEditSave(iso);
    setBusy(false);
    setEditing(false);
  }

  return (
    <CompactFieldCell
      label={label}
      valueNode={at ? `${formatDateYYYYMMDD(at)} ${formatTimeHHmm(at)}` : '-'}
      byline={byEmail ? `โดย ${byEmail}` : null}
      canWrite={canWrite}
      editing={editing}
      onToggleEdit={() => (editing ? setEditing(false) : openEdit())}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          aria-label={`${label} date`}
          type="date"
          value={editDate}
          onChange={(e) => setEditDate(e.target.value)}
          style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: 12, padding: '5px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <input
          aria-label={`${label} time`}
          type="time"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: 12, padding: '5px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !editDate || !editValue} onClick={saveEdit}>
          บันทึก
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={async () => { setBusy(true); await onRecordNow(); setBusy(false); setEditing(false); }}
        >
          ⏺ เวลาปัจจุบัน
        </button>
      </div>
    </CompactFieldCell>
  );
}

// Shared by the same two callers for the goods/truck temperature reading
// taken at receiving or dispatch — same compact cell shape as the time
// control above, just a single text input instead of date+time.
export function WorkPhaseTemperatureControl({
  canWrite,
  goodsLabel,
  truckLabel,
  goodsTemp,
  truckTemp,
  onSaveGoods,
  onSaveTruck,
}) {
  return (
    <>
      <TemperatureRow label={goodsLabel} value={goodsTemp} canWrite={canWrite} onSave={onSaveGoods} />
      <TemperatureRow label={truckLabel} value={truckTemp} canWrite={canWrite} onSave={onSaveTruck} />
    </>
  );
}

function TemperatureRow({ label, value, canWrite, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  function openEdit() {
    setDraft(value ?? '');
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    await onSave(draft);
    setBusy(false);
    setEditing(false);
  }

  return (
    <CompactFieldCell
      label={label}
      valueNode={value ?? '-'}
      canWrite={canWrite}
      editing={editing}
      onToggleEdit={() => (editing ? setEditing(false) : openEdit())}
    >
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="เช่น -18°C"
        style={{ font: 'inherit', fontSize: 12, padding: '5px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}
      />
      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={save}>
        บันทึก
      </button>
    </CompactFieldCell>
  );
}

// "คิด OT" cell — same compact shape as the cells above. Marks the whole
// document as overtime work, either วันทำการ (WORKDAY → OVERTIME rate) or
// วันหยุดพิเศษ (HOLIDAY → OVERTIME_HOLIDAY rate). Billing pools a customer's
// OT per work day + type and charges the minimum once per pool
// (computeOvertimePoolLines). `estimate` is the caller's useOvertimeEstimate().
export function OvertimeControl({ canWrite, isOvertime, overtimeType, note, setByEmail, estimate, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draftChoice, setDraftChoice] = useState('NONE');
  const [draftNote, setDraftNote] = useState('');
  const [busy, setBusy] = useState(false);

  function openEdit() {
    setDraftChoice(isOvertime ? (overtimeType === 'HOLIDAY' ? 'HOLIDAY' : 'WORKDAY') : 'NONE');
    setDraftNote(note ?? '');
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    await onSave(draftChoice !== 'NONE', draftNote, draftChoice === 'HOLIDAY' ? 'HOLIDAY' : 'WORKDAY');
    setBusy(false);
    setEditing(false);
  }

  const bylineParts = [];
  if (isOvertime && note) bylineParts.push(note);
  if (setByEmail) bylineParts.push(`โดย ${setByEmail}`);
  const kindLabel = overtimeType === 'HOLIDAY' ? 'OT วันหยุดพิเศษ' : 'OT วันทำการ';
  const choices = [
    { value: 'NONE', label: 'ไม่คิด' },
    { value: 'WORKDAY', label: 'OT วันทำการ', rate: estimate?.rateInfo?.WORKDAY },
    { value: 'HOLIDAY', label: 'OT วันหยุดพิเศษ', rate: estimate?.rateInfo?.HOLIDAY },
  ];

  return (
    <CompactFieldCell
      label="คิด OT"
      valueNode={isOvertime ? (
        <span style={{ fontWeight: 700, color: '#c2570b' }}>
          ✔ {kindLabel}
          {estimate && <OvertimeEstimateText estimate={estimate} />}
        </span>
      ) : '-'}
      byline={bylineParts.length ? bylineParts.join(' · ') : null}
      canWrite={canWrite}
      editing={editing}
      onToggleEdit={() => (editing ? setEditing(false) : openEdit())}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        {choices.map((choice) => (
          <label key={choice.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" checked={draftChoice === choice.value} onChange={() => setDraftChoice(choice.value)} />
            <span>{choice.label}</span>
            {choice.value !== 'NONE' && estimate && !estimate.loading && (
              <span style={{ color: choice.rate ? 'var(--tgd-muted-text)' : 'var(--tgd-warning, #b45309)', fontSize: 11 }}>
                {choice.rate ? formatRateInfo(choice.rate) : 'ยังไม่ตั้ง rate'}
              </span>
            )}
          </label>
        ))}
      </div>
      <input
        type="text"
        value={draftNote}
        onChange={(e) => setDraftNote(e.target.value)}
        placeholder="หมายเหตุ เช่น ลงงานหลัง 18:00"
        style={{ font: 'inherit', fontSize: 12, padding: '5px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}
      />
      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={save}>
        บันทึก
      </button>
    </CompactFieldCell>
  );
}

const fmt2 = (n) => Number(n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatRateInfo(rate) {
  const min = rate.min_charge_amount != null ? ` · ขั้นต่ำ ${fmt2(rate.min_charge_amount)}` : '';
  return `${Number(rate.rate)} ฿/กก.${min}`;
}

function formatDmy(isoDate) {
  if (!isoDate) return '-';
  const [y, m, d] = String(isoDate).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function OvertimeEstimateText({ estimate }) {
  const muted = { fontSize: 11, fontWeight: 400, color: 'var(--tgd-muted-text)' };
  if (estimate.loading) return <div style={muted}>กำลังคำนวณ...</div>;
  if (!estimate.pool) {
    return <div style={{ ...muted, color: 'var(--tgd-warning, #b45309)' }}>ไม่พบ rate OT (ต่อ กก.) ของประเภทนี้</div>;
  }
  const { pool, share } = estimate;
  return (
    <div style={muted}>
      <div>รวม OT ของลูกค้าวันที่ {formatDmy(pool.workDate)}: {pool.documentCount} ใบ · {fmt2(pool.totalWeight)} กก.</div>
      <div>
        ฿{fmt2(pool.rawAmount)}
        {pool.minApplied ? ` → ขั้นต่ำ ฿${fmt2(pool.poolAmount)}` : ''}
      </div>
      <div style={{ fontWeight: 700, color: '#c2570b' }}>
        ส่วนของใบนี้ ({fmt2(share.weight)} กก.) = ฿{fmt2(share.amount)}
        {estimate.isProvisional ? ' (ประมาณการ)' : ''}
      </div>
    </div>
  );
}

// Live estimate of this document's OT: loads the customer's OT rates and
// every document currently marked OT (listOvertimeFlaggedDocuments), pools
// them with the same computeOvertimePoolLines billing uses, and returns the
// pool this document falls in plus this document's share. refreshKey should
// change whenever this document's OT flag/type or line weights change.
// Always returns rateInfo (the customer-wide PER_KG rate per OT type) once
// loaded, so the edit popover can show both rates.
export function useOvertimeEstimate({ customerId, requestId, requestType, enabled, refreshKey = '' }) {
  const [rates, setRates] = useState(null);
  const [docs, setDocs] = useState(null);

  useEffect(() => {
    setRates(null);
    if (!customerId) return undefined;
    let cancelled = false;
    listAllProductServiceRates({ customerId, isActive: true }).then((result) => {
      if (!cancelled) {
        setRates((result?.data ?? []).filter((r) => r.unit_basis === 'PER_KG'
          && (r.service_type === 'OVERTIME' || r.service_type === 'OVERTIME_HOLIDAY')));
      }
    });
    return () => { cancelled = true; };
  }, [customerId]);

  useEffect(() => {
    setDocs(null);
    if (!enabled || !customerId) return undefined;
    let cancelled = false;
    listOvertimeFlaggedDocuments(customerId).then((result) => {
      if (!cancelled) setDocs(result?.data ?? []);
    });
    return () => { cancelled = true; };
  }, [customerId, enabled, refreshKey]);

  if (!customerId) return null;
  if (!rates) return { loading: true };

  const customerWide = (type) => rates.find((r) => r.service_type === type && !r.customer_product_id)
    ?? rates.find((r) => r.service_type === type) ?? null;
  const rateInfo = { WORKDAY: customerWide('OVERTIME'), HOLIDAY: customerWide('OVERTIME_HOLIDAY') };
  if (!enabled) return { loading: false, rateInfo };
  if (!docs) return { loading: true, rateInfo };

  const productIdByCode = new Map(
    rates.filter((r) => r.customer_product_code).map((r) => [r.customer_product_code, r.customer_product_id]),
  );
  const inputs = docs.flatMap((doc) => doc.lines.map((line, index) => ({
    id: `${doc.requestType}:${doc.requestId}:${index}`,
    requestId: doc.requestId,
    requestType: doc.requestType,
    customerId,
    customerProductId: productIdByCode.get(line.customer_product_code) ?? null,
    temperatureType: line.temperature_type ?? null,
    weight: Number(line.weight ?? 0),
    workDate: doc.workDate,
    overtimeType: doc.overtimeType,
  })));
  const mine = computeOvertimePoolLines({ lines: inputs, rates })
    .filter((l) => l.requestType === requestType && l.sourceRequestId === requestId);
  const thisDoc = docs.find((d) => d.requestType === requestType && d.requestId === requestId);

  return {
    loading: false,
    rateInfo,
    pool: mine[0]?.pool ?? null,
    share: {
      weight: mine.reduce((sum, l) => sum + l.weight, 0),
      amount: mine.reduce((sum, l) => sum + l.amount, 0),
    },
    isProvisional: Boolean(thisDoc?.lines.some((l) => !l.isActual)),
  };
}

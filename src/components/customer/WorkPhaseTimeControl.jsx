import { useState } from 'react';
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

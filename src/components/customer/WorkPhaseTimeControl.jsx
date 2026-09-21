import { useState } from 'react';
import { combineDateWithEditedTime, formatTimeHHmm } from '../../utils/workTimerUtils.js';

// Shared by CustomerAdminDepositReviewPage and CustomerAdminWithdrawalReviewPage
// for the "เวลาปฏิบัติงาน" section — each row offers both a one-click
// "บันทึกเวลาปัจจุบัน" stamp and a pencil-edit popover for after-the-fact
// corrections, per how the admin desktop is meant to work (unlike Scan
// Center, which only needs self-correction, admin also needs to be able to
// record a time nobody tapped live for).
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
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PhaseRow
        label={startedLabel}
        at={startedAt}
        byEmail={startedByEmail}
        canWrite={canWrite}
        onRecordNow={onRecordStart}
        onEditSave={onEditStart}
      />
      <PhaseRow
        label={finishedLabel}
        at={finishedAt}
        byEmail={finishedByEmail}
        canWrite={canWrite}
        onRecordNow={onRecordFinish}
        onEditSave={onEditFinish}
      />
    </div>
  );
}

function PhaseRow({ label, at, byEmail, canWrite, onRecordNow, onEditSave }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  function openEdit() {
    setEditValue(formatTimeHHmm(at) ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    const iso = combineDateWithEditedTime(at, editValue);
    if (!iso) { setEditing(false); return; }
    setBusy(true);
    await onEditSave(iso);
    setBusy(false);
    setEditing(false);
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ minWidth: 160, fontSize: 13, color: '#475569' }}>{label}</div>
      <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
          {formatTimeHHmm(at) ?? '-'}
        </span>
        {byEmail && <span style={{ fontSize: 11, color: '#94a3b8' }}>โดย {byEmail}</span>}
      </div>
      {canWrite && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={async () => { setBusy(true); await onRecordNow(); setBusy(false); }}>
            ⏺ บันทึกเวลาปัจจุบัน
          </button>
          <button
            type="button"
            onClick={openEdit}
            aria-label={`แก้ไข${label}`}
            style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', padding: '2px 6px' }}
          >
            ✏️
          </button>
        </div>
      )}

      {editing && (
        <div style={{
          width: '100%', marginTop: 4, background: '#fff', border: '1px dashed #0b7285',
          borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
            เวลาที่ถูกต้อง
            <input
              type="time"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{ font: 'inherit', padding: '5px 7px', borderRadius: 6, border: '1px solid #e2e8f0' }}
            />
          </label>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>ยกเลิก</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={saveEdit}>บันทึก</button>
        </div>
      )}
    </div>
  );
}

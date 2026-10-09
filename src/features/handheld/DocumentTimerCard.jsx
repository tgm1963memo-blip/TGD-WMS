import { useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { triggerSuccessFeedback } from './handheldUi.jsx';
import { formatDurationBetween, combineDateWithEditedTime, formatTimeHHmm } from '../../utils/workTimerUtils.js';

// Shared by ReceivingWorkflow and PickingWorkflow in HandheldPage.jsx — both
// need the exact same "เริ่ม/สิ้นสุด" card, just with different labels and a
// different pair of onStart/onFinish/onEdit* callbacks wired to the deposit
// vs. withdrawal time-tracking RPCs. Staff can correct their own tap
// immediately via the pencil icon (no admin approval needed) — that's the
// same edit affordance whether the phase is already finished or only started.
//
// overtime/onToggleOvertime are optional: when given, a "งานนี้คิด OT" switch
// renders under the timer (staff mark the document as overtime work from
// the floor; admin sees/overrides the same flag on the web header).
export function DocumentTimerCard({ label, startedAt, finishedAt, onStart, onFinish, onEditStart, onEditFinish, overtime = null, onToggleOvertime = null }) {
  const [editingPhase, setEditingPhase] = useState(null); // 'START' | 'FINISH' | null
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  function openEdit(phase, currentIso) {
    setEditingPhase(phase);
    setEditValue(formatTimeHHmm(currentIso) ?? '');
  }

  async function saveEdit() {
    const iso = combineDateWithEditedTime(
      editingPhase === 'START' ? startedAt : finishedAt,
      editValue
    );
    if (!iso) { setEditingPhase(null); return; }
    setBusy(true);
    if (editingPhase === 'START') await onEditStart(iso);
    else await onEditFinish(iso);
    setBusy(false);
    setEditingPhase(null);
  }

  const duration = formatDurationBetween(startedAt, finishedAt);

  return (
    <div style={{
      margin: '0 14px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0',
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 10 }}>
        ⏱ เวลาใน{label}
      </div>

      {!startedAt && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); await onStart(); setBusy(false); }}
          style={{
            width: '100%', background: '#09111c', color: '#fff', border: 'none',
            borderRadius: 12, padding: '13px 14px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          }}
        >
          ▶ เริ่ม{label}
        </button>
      )}

      {startedAt && (
        <TimeRow
          label="เริ่ม" iso={startedAt}
          onEdit={() => openEdit('START', startedAt)}
        />
      )}

      {startedAt && editingPhase !== 'START' && !finishedAt && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); await onFinish(); setBusy(false); }}
          style={{
            width: '100%', marginTop: 10, background: '#059669', color: '#fff', border: 'none',
            borderRadius: 12, padding: '13px 14px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          }}
        >
          ■ สิ้นสุด{label}
        </button>
      )}

      {finishedAt && (
        <div style={{ marginTop: 8 }}>
          <TimeRow label="สิ้นสุด" iso={finishedAt} onEdit={() => openEdit('FINISH', finishedAt)} />
        </div>
      )}

      {duration && (
        <div style={{
          display: 'inline-block', marginTop: 10, background: '#ecfdf5', color: '#059669',
          fontSize: 12, fontWeight: 800, borderRadius: 999, padding: '5px 12px',
        }}>
          ใช้เวลา {duration}
        </div>
      )}

      {onToggleOvertime && overtime && (
        <OvertimeSwitchRow overtime={overtime} onToggle={onToggleOvertime} />
      )}

      {editingPhase && (
        <div style={{
          marginTop: 10, background: '#fff', border: '1px dashed #09111c', borderRadius: 10, padding: 10,
        }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#475569', marginBottom: 8 }}>
            เวลาที่ถูกต้อง
            <input
              type="time"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{ font: 'inherit', padding: '7px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditingPhase(null)} style={{
              background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}>
              ยกเลิก
            </button>
            <button type="button" disabled={busy} onClick={saveEdit} style={{
              background: '#09111c', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}>
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeRow({ label, iso, onEdit }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
      border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 11px',
    }}>
      <span style={{ fontSize: 12, color: '#475569', width: 46, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, flex: 1 }}>
        {formatTimeHHmm(iso) ?? '-'} น.
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`แก้ไขเวลา${label}`}
        style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', padding: '2px 4px' }}
      >
        ✏️
      </button>
    </div>
  );
}

// Tapping the switch saves immediately; the note saves on blur. Disabled
// while offline — the flag feeds billing, so it is never queued.
function OvertimeSwitchRow({ overtime, onToggle }) {
  const isOnline = useOnlineStatus();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(overtime.note ?? '');
  const [error, setError] = useState('');
  const on = Boolean(overtime.isOvertime);
  const disabled = busy || !isOnline;

  async function save(next, nextNote) {
    setBusy(true);
    setError('');
    const result = await onToggle(next, nextNote);
    setBusy(false);
    if (result?.error) {
      setError(result.error.message ?? 'บันทึก OT ไม่สำเร็จ');
      return;
    }
    triggerSuccessFeedback();
  }

  return (
    <div style={{
      marginTop: 10, borderRadius: 10, padding: '9px 11px',
      background: on ? '#fff7ed' : '#fff', border: `1px solid ${on ? '#fdba74' : '#e2e8f0'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, flex: 1, color: on ? '#c2570b' : '#334155' }}>
          🌙 งานนี้คิด OT
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="งานนี้คิด OT"
          disabled={disabled}
          onClick={() => save(!on, note)}
          style={{
            width: 52, height: 30, borderRadius: 999, border: 'none', padding: 3,
            cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
            background: on ? '#f97316' : '#cbd5e1', transition: 'background 0.2s',
            display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
          }}
        >
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </button>
      </div>
      {!isOnline && (
        <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 6 }}>ต้องออนไลน์เพื่อบันทึก OT</div>
      )}
      {on && (
        <>
          <input
            type="text"
            value={note}
            disabled={disabled}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (note !== (overtime.note ?? '')) save(true, note); }}
            placeholder="หมายเหตุ (ไม่บังคับ)"
            style={{
              width: '100%', boxSizing: 'border-box', marginTop: 8, font: 'inherit', fontSize: 13,
              padding: '7px 8px', borderRadius: 8, border: '1px solid #e2e8f0',
            }}
          />
          {overtime.setByEmail && (
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
              ติ๊กโดย {overtime.setByEmail}{overtime.setAt ? ` · ${formatTimeHHmm(overtime.setAt)} น.` : ''}
            </div>
          )}
        </>
      )}
      {error && <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 6 }}>{error}</div>}
    </div>
  );
}

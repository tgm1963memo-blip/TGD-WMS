import { useState } from 'react';
import { removeAction, updateStatus } from '../../utils/offlineActionQueue.js';
import { C } from './handheldUi.jsx';

const actionButton = {
  minHeight: 44, padding: '0 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
};

function describe(item) {
  const { palletNo, locationCode, productName } = item.payload ?? {};
  return [locationCode, palletNo != null ? `พาเลท ${palletNo}` : null, productName].filter(Boolean).join(' · ') || 'ไม่ทราบรายการ';
}

// `interrupted` items are older queued records the app was killed in the
// middle of sending, from before the server could recognise a resend: it
// may or may not have saved them, and it accepts a duplicate pallet with
// only a warning, so a person checks and decides.
export function OfflineQueueBanner({ isOnline, pending, interrupted, lastResult, onChanged }) {
  const [confirmingId, setConfirmingId] = useState(null);

  async function resend(item) {
    await updateStatus(item.id, 'pending');
    await onChanged();
  }

  // Two taps, because a stray tap (gloves, cold room) would otherwise throw
  // away an allocation that may never have reached the server.
  async function discard(item) {
    if (confirmingId !== item.id) {
      setConfirmingId(item.id);
      return;
    }
    setConfirmingId(null);
    await removeAction(item.id);
    await onChanged();
  }

  const failed = lastResult?.failed > 0;
  const firstError = lastResult?.failures?.[0]?.errorMessage;

  return (
    <>
      {!isOnline && (
        <div data-testid="handheld-offline-banner" style={{ background: '#fef3c7', color: '#78350f', padding: '12px 28px', fontSize: 14, fontWeight: 700 }}>
          {pending > 0 ? `📶 ออฟไลน์ · รอซิงก์ ${pending} รายการ` : '📶 ออฟไลน์'}
        </div>
      )}
      {isOnline && lastResult && !failed && (
        <div data-testid="handheld-sync-result" style={{ background: C.greenLight, color: '#14532d', padding: '12px 28px', fontSize: 14, fontWeight: 700 }}>
          {`✓ ซิงก์สำเร็จ ${lastResult.synced} รายการ`}
        </div>
      )}
      {isOnline && failed && (
        <div data-testid="handheld-sync-failed" style={{ background: C.redLight, color: '#7f1d1d', padding: '12px 28px', fontSize: 14 }}>
          <div style={{ fontWeight: 700 }}>
            {`⚠️ ซิงก์ไม่สำเร็จ ${lastResult.failed} รายการ${lastResult.synced > 0 ? ` · สำเร็จ ${lastResult.synced} รายการ` : ''}`}
          </div>
          <div style={{ marginTop: 4 }}>{`ระบบจะลองส่งใหม่เอง${firstError ? ` · สาเหตุ: ${firstError}` : ''}`}</div>
        </div>
      )}
      {isOnline && !lastResult && pending > 0 && (
        <div data-testid="handheld-sync-pending" style={{ background: '#fef3c7', color: '#78350f', padding: '12px 28px', fontSize: 14, fontWeight: 700 }}>
          {`รอซิงก์ ${pending} รายการ`}
        </div>
      )}
      {interrupted.length > 0 && (
        <div data-testid="handheld-interrupted-items" style={{ background: C.redLight, color: '#7f1d1d', padding: '12px 28px', fontSize: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {`⚠️ ไม่แน่ใจว่าบันทึกสำเร็จ ${interrupted.length} รายการ`}
          </div>
          <div style={{ marginBottom: 8 }}>แอปถูกปิดระหว่างส่งข้อมูล กรุณาตรวจ Location ของพาเลทก่อน ถ้ายังไม่มีให้กดส่งซ้ำ ถ้ามีแล้วให้กดทิ้งรายการ</div>
          {interrupted.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <span style={{ flex: 1, minWidth: 160, fontWeight: 700 }}>{describe(item)}</span>
              <button type="button" onClick={() => resend(item)} disabled={!isOnline} style={{ ...actionButton, border: 'none', background: C.headerBg, color: '#fff', opacity: isOnline ? 1 : 0.5 }}>ส่งซ้ำ</button>
              <button type="button" onClick={() => discard(item)} style={{ ...actionButton, border: '1px solid #fca5a5', background: confirmingId === item.id ? '#7f1d1d' : '#fff', color: confirmingId === item.id ? '#fff' : '#7f1d1d' }}>
                {confirmingId === item.id ? 'กดอีกครั้งเพื่อทิ้ง' : 'ทิ้งรายการ'}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

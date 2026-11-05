import { useState } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js';
import { C } from './handheldUi.jsx';

const IOS_STEPS = [
  ['เปิดระบบใน Safari', 'ถ้าเปิดจาก LINE หรือ Chrome ให้คัดลอกลิงก์ไปเปิดใน Safari ก่อน'],
  ['กดปุ่มแชร์', 'ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น'],
  ['เลือก "เพิ่มไปยังหน้าจอโฮม"', 'กด "เพิ่ม" ที่มุมขวาบน'],
  ['เปิดจากไอคอน TGC WMS', 'เข้าสู่ระบบใหม่อีกครั้งในแอป'],
];

// The iOS share glyph, drawn inline so the steps match what Safari shows.
function ShareGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9" />
    </svg>
  );
}

const button = { flex: 1, height: 48, borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' };

export function HandheldInstallPrompt() {
  const { mode, install, dismiss } = useInstallPrompt();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (!mode) return null;

  return (
    <div data-testid="handheld-install-prompt" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <img src="/icons/icon-192.png" alt="" width="48" height="48" style={{ borderRadius: 10 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>ติดตั้ง TGC WMS ลงเครื่อง</div>
          <div style={{ fontSize: 13, color: C.textSec }}>เปิดจากไอคอนได้เลย ใช้งานเต็มจอ</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={dismiss} style={{ ...button, border: `1px solid ${C.border}`, background: '#fff', color: C.text }}>ไว้ทีหลัง</button>
        <button type="button" onClick={mode === 'ios' ? () => setShowIosSteps(true) : install} style={{ ...button, border: 'none', background: C.gold, color: C.headerBg }}>
          {mode === 'ios' ? 'ดูวิธีติดตั้ง' : 'ติดตั้ง'}
        </button>
      </div>
      <Modal isOpen={showIosSteps} onClose={() => setShowIosSteps(false)} title="วิธีติดตั้งบน iPhone" size="sm">
        {IOS_STEPS.map(([title, detail], index) => (
          <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 16, background: C.headerBg, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{index + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 14, color: C.textSec }}>{detail}</div>
            </div>
            {index === 1 && <ShareGlyph />}
          </div>
        ))}
      </Modal>
    </div>
  );
}

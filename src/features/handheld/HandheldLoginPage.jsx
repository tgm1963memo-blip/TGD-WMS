import { useState, useEffect } from 'react';
import { useHandheldAuth } from './HandheldContext.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const ROLE_LABELS = {
  admin: 'Admin',
  warehouse_manager: 'ผจก.คลัง',
  warehouse_admin: 'ธุรการคลัง',
  warehouse_staff: 'พนักงานคลัง',
  accounting: 'บัญชี',
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HandheldLoginPage() {
  const [step, setStep] = useState('staff'); // 'staff' | 'pin'
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { listHandheldStaff, loginWithPin } = useHandheldAuth();
  const { language } = useTranslation();

  useEffect(() => {
    let active = true;
    setStaffLoading(true);
    setStaffError('');
    listHandheldStaff()
      .then((rows) => { if (active) { setStaffList(rows); setStaffLoading(false); } })
      .catch((err) => { if (active) { setStaffError(err.message || 'ไม่สามารถโหลดรายชื่อพนักงาน'); setStaffLoading(false); } });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectStaff(staff) {
    setSelectedStaff(staff);
    setPin('');
    setPinError('');
    setStep('pin');
  }

  function backToStaff() {
    setStep('staff');
    setSelectedStaff(null);
    setPin('');
    setPinError('');
  }

  function handleKeyPress(num) {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
      setPinError('');
    }
  }

  function handleBackspace() {
    setPin((prev) => prev.slice(0, -1));
    setPinError('');
  }

  async function handleSubmit() {
    if (!pin || !selectedStaff) return;
    setIsLoading(true);
    setPinError('');
    try {
      await loginWithPin(selectedStaff.id, pin);
    } catch (err) {
      setPinError(err.message || 'รหัส PIN ไม่ถูกต้อง');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  }

  const containerStyle = {
    background: '#f8fafb',
    minHeight: 'var(--handheld-screen-height)',
    display: 'flex',
    flexDirection: 'column',
    padding: '40px 24px',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 720,
    margin: '0 auto',
  };

  if (step === 'staff') {
    return (
      <div data-testid="handheld-login-page" style={containerStyle}>
        <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-gold)', letterSpacing: '-0.01em', marginBottom: 2 }}>
              TGC Cold Storage
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Handheld</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 500 }}>
              {language === 'th' ? 'เลือกชื่อของคุณเพื่อเข้าสู่ระบบ' : 'Select your name to continue'}
            </div>
          </div>

          {staffLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', paddingTop: 48 }}>
              กำลังโหลดรายชื่อพนักงาน…
            </div>
          ) : staffError ? (
            <div style={{ textAlign: 'center', color: '#ef4444', paddingTop: 48 }}>
              {staffError}
            </div>
          ) : staffList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-subtle)', paddingTop: 48, fontSize: 14 }}>
              ไม่พบพนักงานที่มี PIN ในระบบ<br />กรุณาติดต่อผู้ดูแลระบบ
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staffList.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => selectStaff(staff)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '20px 24px',
                    background: 'var(--color-surface-muted)',
                    border: '2px solid #e2e8f0',
                    borderRadius: 20,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    minHeight: 80,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-text)'; e.currentTarget.style.background = 'var(--color-surface-sunken)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface-muted)'; }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--color-text)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 800,
                    flexShrink: 0,
                    letterSpacing: '-0.02em',
                  }}>
                    {getInitials(staff.displayName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
                      {staff.displayName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 2 }}>
                      {ROLE_LABELS[staff.role] ?? staff.role}
                    </div>
                  </div>
                  <div style={{ color: 'var(--color-border-strong)', fontSize: 20 }}>›</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step: PIN entry for selected staff
  return (
    <div data-testid="handheld-login-page" style={containerStyle}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        {/* Back button */}
        <button
          type="button"
          onClick={backToStaff}
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 4px',
          }}
        >
          ‹ กลับ
        </button>

        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--color-text)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 900,
            margin: '0 auto 16px',
            letterSpacing: '-0.02em',
          }}>
            {getInitials(selectedStaff?.displayName)}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginBottom: 4 }}>
            {selectedStaff?.displayName}
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 500 }}>
            {language === 'th' ? 'กรอกรหัส PIN ของคุณ' : 'Enter your PIN'}
          </div>
        </div>

        {/* PIN dots */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, height: 60, alignItems: 'center' }}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <div key={i} style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: i < pin.length ? 'var(--color-text)' : 'var(--color-surface-sunken)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>

        {pinError && (
          <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
            {pinError}
          </div>
        )}

        {/* Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%', maxWidth: 320 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num.toString())}
              disabled={isLoading}
              style={{
                background: 'var(--color-surface-muted)',
                border: 'none',
                borderRadius: 16,
                padding: '24px 0',
                fontSize: 24,
                fontWeight: 600,
                color: 'var(--color-text)',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isLoading || !pin}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            disabled={isLoading}
            style={{
              background: 'var(--color-surface-muted)',
              border: 'none',
              borderRadius: 16,
              padding: '24px 0',
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--color-text)',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !pin}
            style={{
              background: pin ? 'var(--color-text)' : 'var(--color-surface-sunken)',
              color: pin ? '#ffffff' : 'var(--color-text-subtle)',
              border: 'none',
              borderRadius: 16,
              fontSize: 18,
              fontWeight: 800,
              cursor: pin ? 'pointer' : 'default',
              transition: 'background 0.2s',
            }}
          >
            {isLoading ? '…' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

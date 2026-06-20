import { useState } from 'react';
import { useHandheldAuth } from './HandheldContext.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function HandheldLoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithPin } = useHandheldAuth();
  const { language } = useTranslation();

  const handleKeyPress = (num) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = async () => {
    if (!pin) return;
    setIsLoading(true);
    setError('');
    try {
      await loginWithPin(pin);
    } catch (err) {
      setError(err.message || 'รหัส PIN ไม่ถูกต้อง');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-testid="handheld-login-page" style={{ 
      background: '#ffffff', 
      minHeight: '100dvh', 
      display: 'flex', 
      flexDirection: 'column',
      padding: '40px 24px',
      boxSizing: 'border-box'
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8 }}>
            TGC Handheld
          </div>
          <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>
            {language === 'th' ? 'กรุณากรอกรหัส PIN ของคุณ' : 'Enter your PIN'}
          </div>
        </div>

        {/* PIN Display */}
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          marginBottom: 32, 
          height: 60,
          alignItems: 'center'
        }}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <div key={i} style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: i < pin.length ? '#0f172a' : '#f1f5f9',
              transition: 'all 0.2s'
            }} />
          ))}
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Keypad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          width: '100%',
          maxWidth: 320
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num.toString())}
              disabled={isLoading}
              style={{
                background: '#f8fafc',
                border: 'none',
                borderRadius: 16,
                padding: '24px 0',
                fontSize: 24,
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer',
                touchAction: 'manipulation', // Prevents double-tap zoom
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
              color: '#64748b',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            disabled={isLoading}
            style={{
              background: '#f8fafc',
              border: 'none',
              borderRadius: 16,
              padding: '24px 0',
              fontSize: 24,
              fontWeight: 600,
              color: '#0f172a',
              cursor: 'pointer'
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !pin}
            style={{
              background: pin ? '#0f172a' : '#f1f5f9',
              color: pin ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: 16,
              fontSize: 18,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

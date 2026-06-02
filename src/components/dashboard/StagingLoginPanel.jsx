import { useState } from 'react';
import { signInToStaging, signOutFromStaging } from '../../services/stagingAuthService.js';

export function StagingLoginPanel({ session, onSessionChange }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signInToStaging(email, password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSessionChange?.(result.data);
    setPassword('');
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);

    const result = await signOutFromStaging();
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSessionChange?.(null);
  }

  return (
    <section
      className="staging-login-panel"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
        marginBottom: 18,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <strong>เข้าสู่ระบบ Staging</strong>
        <span style={{ color: '#526173', fontSize: 14 }}>
          ใช้ Supabase Auth เพื่ออ่านข้อมูล Stock ตามสิทธิ์ RLS
        </span>
      </div>

      {session?.user ? (
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ color: '#166534', fontWeight: 700 }}>Authenticated: Yes</span>
          <span>{session.user.email}</span>
          <button className="secondary-button" disabled={busy} onClick={handleSignOut} type="button">
            ออกจากระบบ
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignIn} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <div style={{ alignItems: 'end', display: 'flex' }}>
            <button className="primary-button" disabled={busy} type="submit">
              เข้าสู่ระบบ
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p role="alert" style={{ color: '#991b1b', margin: '12px 0 0' }}>
          เข้าสู่ระบบ Staging ไม่สำเร็จ: {error.message ?? String(error)}
        </p>
      ) : null}
    </section>
  );
}

export default StagingLoginPanel;

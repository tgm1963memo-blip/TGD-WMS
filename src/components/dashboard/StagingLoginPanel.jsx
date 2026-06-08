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
    <section className="staging-login-panel">
      <div className="login-form-header">
        <h2>เข้าสู่ระบบ Staging</h2>
        <p>Please enter your credentials to log in.</p>
        <p className="login-form-helper">Use Supabase Auth account</p>
      </div>

      {error ? (
        <div className="banner banner-danger login-error-banner" role="alert">
          เข้าสู่ระบบ Staging ไม่สำเร็จ: {error.message ?? String(error)}
        </div>
      ) : null}

      {session?.user ? (
        <div className="login-session-bar">
          <span className="login-session-status">Authenticated: Yes</span>
          <span>{session.user.email}</span>
          <button className="btn btn-outline secondary-button" disabled={busy} onClick={handleSignOut} type="button">
            ออกจากระบบ
          </button>
        </div>
      ) : (
        <form className="login-form-grid" onSubmit={handleSignIn}>
          <div className="form-group">
            <label className="form-label" htmlFor="staging-login-email">
              Email Address
            </label>
            <input
              autoComplete="email"
              className={`form-control${error ? ' is-invalid' : ''}`}
              id="staging-login-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="staging-login-password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className={`form-control${error ? ' is-invalid' : ''}`}
              id="staging-login-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </div>
          <div className="form-group login-form-actions">
            <button className="btn btn-primary btn-block primary-button" disabled={busy} type="submit">
              เข้าสู่ระบบ
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default StagingLoginPanel;

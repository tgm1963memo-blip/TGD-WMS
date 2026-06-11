import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { signOutFromStaging } from '../../services/stagingAuthService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function UserSessionMenu() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!session?.user) {
    return null;
  }

  async function handleLogout() {
    setBusy(true);
    setError(null);

    const result = await signOutFromStaging();
    setBusy(false);

    if (result.error) {
      setError(t('logout_failed') || 'Unable to sign out. Please try again.');
      return;
    }

    navigate('/login', { replace: true });
  }

  return (
    <div className="sidebar-user-session" data-testid="user-session-menu">
      <span className="sidebar-user-email">{session.user.email}</span>
      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
      <button
        type="button"
        className="btn btn-outline sidebar-logout-button"
        data-testid="logout-button"
        disabled={busy}
        onClick={handleLogout}
      >
        {t('logout') || 'Logout'}
      </button>
    </div>
  );
}

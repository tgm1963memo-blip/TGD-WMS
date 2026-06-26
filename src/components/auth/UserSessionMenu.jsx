import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { signOutFromStaging } from '../../services/stagingAuthService.js';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function UserSessionMenu() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    let active = true;

    getCurrentUserProfile(session?.user?.id).then((result) => {
      if (!active) return;
      setRole(result.data?.role ?? null);
    });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

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
    <div className="sidebar-user-session user-session-menu" data-testid="user-session-menu">
      <div className="user-session-menu-identity">
        <span className="sidebar-user-email" data-testid="user-session-email">{session.user.email}</span>
        {role ? (
          <span className="user-session-role-badge" data-testid="user-session-role">{role}</span>
        ) : null}
      </div>
      <Link
        className="user-session-profile-link"
        data-testid="user-profile-settings-link"
        to="/settings/profile"
      >
        {t('user_menu_profile')}
      </Link>
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

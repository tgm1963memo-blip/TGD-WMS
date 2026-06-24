import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { navigationItems } from '../../app/navigation.js';
import { AppShell } from './AppShell.jsx';

function getCurrentSection(pathname) {
  return navigationItems.find((item) => item.path === pathname)?.label ?? 'Dashboard';
}

export function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    // Automatically process email queue every 2 minutes as a fallback for missing Vercel cron
    const interval = setInterval(() => {
      fetch('/api/process-email-queue', { method: 'POST' }).catch(() => {});
    }, 120_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppShell currentSection={getCurrentSection(location.pathname)}>
      <Outlet />
    </AppShell>
  );
}

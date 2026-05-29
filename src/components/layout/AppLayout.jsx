import { Outlet, useLocation } from 'react-router-dom';
import { navigationItems } from '../../app/navigation.js';
import { AppShell } from './AppShell.jsx';

function getCurrentSection(pathname) {
  return navigationItems.find((item) => item.path === pathname)?.label ?? 'Dashboard';
}

export function AppLayout() {
  const location = useLocation();

  return (
    <AppShell currentSection={getCurrentSection(location.pathname)}>
      <Outlet />
    </AppShell>
  );
}

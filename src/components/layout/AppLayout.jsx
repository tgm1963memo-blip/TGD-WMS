import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { navigationGroups } from '../../app/navigation.js';
import { findNavigationContext } from '../../app/navigationSections.js';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';
import { AppShell } from './AppShell.jsx';

const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

export function AppLayout() {
  const location = useLocation();
  const { language } = useLanguage();
  const t = useTranslation();

  useEffect(() => {
    // Automatically process email queue every 2 minutes as a fallback for missing Vercel cron
    const interval = setInterval(() => {
      fetch('/api/process-email-queue', { method: 'POST' }).catch(() => {});
    }, 120_000);
    return () => clearInterval(interval);
  }, []);

  const context = findNavigationContext(navigationGroups, location.pathname, language);
  const pageLabel = context
    ? (t(`nav.${toCamelCase(context.item.key)}`) || context.item.label)
    : (t('nav.dashboard') || 'Dashboard');
  const sectionLabel = context?.sectionLabel ?? null;

  return (
    <AppShell currentSection={pageLabel} sectionLabel={sectionLabel}>
      <Outlet />
    </AppShell>
  );
}

// src/features/reports/ReportsPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { getCurrentUserRole } from '../../security/currentUserRole.js';
import { isDemoRoleSelectorAllowed } from '../../security/demoRoleSelectorControl.js';
import { getAppRuntimeConfig } from '../../config/appConfig.js';
import { canAccessRoute } from '../../security/permissionGuard.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import UserRoleDemoSelector from '../../components/common/UserRoleDemoSelector.jsx';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { brandConfig } from '../../config/brandConfig.js';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';

// Report definitions – using translation keys for titles where possible.
// Literal title fields are kept for legacy test expectations.
const reportDefinitions = [
  {
    key: 'movement_ledger_report',
    title: 'Customer Stock Movement Ledger',
    description: 'Read‑only customer stock movement report for cold storage operations and billing preparation.',
    to: '/reports/movement-ledger',
    permissionArea: 'reports',
    minimumRole: 'viewer',
  },
  {
    key: 'storage_aging_report',
    title: 'Storage Aging / Lot / Expiry / Chargeable Days Report',
    description: 'Read‑only lot aging, expiry monitoring, and chargeable days preparation for stored customer‑owned goods.',
    to: '/reports/storage-aging',
    permissionArea: 'reports',
    minimumRole: 'viewer',
  },
];

export function ReportsPage() {
  const { language } = useLanguage();
  const { role: contextRole, ready: roleReady } = useUserRole();
  const useDemoRole = isDemoRoleSelectorAllowed(getAppRuntimeConfig());
  const currentRole = useDemoRole ? getCurrentUserRole() : contextRole;
  const permissionsReady = useDemoRole || roleReady;
  const goLive = isGoLivePresentationEnabled();

  const canShow = (def) => {
    if (!permissionsReady) return false;
    const decision = canAccessRoute(currentRole, def.to);
    return decision && decision.allowed;
  };

  return (
    <section className={getPageShellClassName('page-shell')} style={{ maxWidth: 1180 }}>
      {!goLive ? <UserRoleDemoSelector /> : null}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <PageHeader
          title={getTranslation('reports', language) || 'Reports'}
          description={getTranslation('report_page_description', language) || 'Read‑only cold storage operation reports.'}
        />
        <LanguageToggle />
      </div>
      <div
        className="summary-grid report-card-grid"
        style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {reportDefinitions.filter(canShow).map((def) => (
          <SectionCard key={def.to}>
            <strong>{getTranslation(def.key, language) || def.title}</strong>
            <p>
              {getTranslation(`${def.key}_description`, language) || def.description}
            </p>
            <Link
              className="action-link"
              style={{
                background: brandConfig.colors.gold,
                borderRadius: 7,
                color: brandConfig.colors.black,
                display: 'inline-flex',
                fontWeight: 700,
                minHeight: 38,
                padding: '8px 12px',
              }}
              to={def.to}
            >
              {getTranslation('open_report', language) || 'Open report'}
            </Link>
          </SectionCard>
        ))}
      </div>
    </section>
  );
}

export default ReportsPage;

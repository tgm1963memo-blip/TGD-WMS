// src/features/reports/ReportsPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUserRole } from '../../security/currentUserRole.js';
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
    key: 'customer_storage_balance_report',
    title: 'Customer Storage Balance Report',
    description: 'Current customer‑owned inventory balances by product, lot, pallet, warehouse, and location.',
    to: '/reports/customer-storage-balance',
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
  {
    key: 'warehouse_operation_performance_report',
    title: 'Warehouse Operation Performance Report',
    description: 'Read‑only warehouse workload and operation charge activity preview for cold storage operations.',
    to: '/reports/warehouse-operation-performance',
    permissionArea: 'reports',
    minimumRole: 'viewer',
  },
  {
    key: 'monthly_storage_billing_summary',
    title: 'Monthly Storage Billing Summary',
    description: 'Preview‑only monthly storage billing support for accounting review.',
    to: '/reports/monthly-storage-billing-summary',
    permissionArea: 'reports',
    minimumRole: 'viewer',
  },
  {
    key: 'billing_movement_weight_report',
    title: 'Billing Movement Weight Report',
    description: 'Read-only preview of movement weight, billable flags, and exclusion reasons before billing approval.',
    to: '/reports/billing-movement-weight',
    permissionArea: 'reports',
    minimumRole: 'viewer',
  },
  {
    key: 'accounting_charge_staging_preview',
    title: 'Accounting Charge Staging Preview',
    description: 'Read‑only staging area to review canonical charges and Bplus draft mappings.',
    to: '/reports/accounting-charge-staging-preview',
    permissionArea: 'accounting_review',
    minimumRole: 'accounting',
  },
  {
    key: 'accounting_charge_handoff_review_draft',
    title: 'Accounting Charge Handoff Review Draft',
    description: 'Review‑only accounting charge handoff draft for Bplus preview. No send, export, invoice, or posting actions.',
    to: '/reports/accounting-charge-handoff-review',
    permissionArea: 'accounting_review',
    minimumRole: 'accounting',
  },
];

export function ReportsPage() {
  const { language } = useLanguage();
  const currentRole = getCurrentUserRole();
  const goLive = isGoLivePresentationEnabled();

  const canShow = (def) => {
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

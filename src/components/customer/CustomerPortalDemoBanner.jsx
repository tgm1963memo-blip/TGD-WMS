import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerPortalDemoBanner({ testId = 'customer-portal-demo-banner' }) {
  const t = useTranslation();

  return (
    <div className="customer-portal-demo-banner warning-panel meeting-safety-panel" data-testid={testId} role="status">
      <div className="customer-portal-demo-banner-title">
        <span className="status-badge status-badge--uat">{t('customer_portal_demo_badge')}</span>
      </div>
      <p>{t('customer_portal_demo_safety_message')}</p>
    </div>
  );
}

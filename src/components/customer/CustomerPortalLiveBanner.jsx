import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerPortalLiveBanner({ testId = 'customer-portal-live-banner' }) {
  const t = useTranslation();

  return (
    <div className="customer-portal-demo-banner info-panel meeting-safety-panel" data-testid={testId} role="status">
      <div className="customer-portal-demo-banner-title">
        <span className="status-badge status-badge--open">{t('customer_portal_live_badge')}</span>
      </div>
      <p>{t('customer_portal_live_safety_message')}</p>
    </div>
  );
}

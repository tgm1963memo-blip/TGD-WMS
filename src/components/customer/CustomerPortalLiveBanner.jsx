import { useTranslation } from '../../i18n/languageProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

export function CustomerPortalLiveBanner({ testId = 'customer-portal-live-banner' }) {
  const t = useTranslation();
  const goLive = isGoLivePresentationEnabled();

  return (
    <div className="customer-portal-demo-banner info-panel meeting-safety-panel" data-testid={testId} role="status">
      <div className="customer-portal-demo-banner-title">
        <span className="status-badge status-badge--open">
          {goLive ? t('customer_live_data_badge') : t('customer_portal_live_badge')}
        </span>
      </div>
      <p>{goLive ? t('customer_portal_golive_message') : t('customer_portal_live_safety_message')}</p>
    </div>
  );
}

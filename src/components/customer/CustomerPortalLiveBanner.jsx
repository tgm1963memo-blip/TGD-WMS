import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';
import { useCustomerPortalProfile, setAdminPortalCustomerId, getAdminPortalCustomerId } from '../../features/customer/useCustomerPortalProfile.js';
import { getCustomers } from '../../services/masterDataService.js';

export function CustomerPortalLiveBanner({ testId = 'customer-portal-live-banner' }) {
  const t = useTranslation();
  const goLive = isGoLivePresentationEnabled();
  const { isRequestProxy } = useCustomerPortalProfile();
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(getAdminPortalCustomerId() || '');

  useEffect(() => {
    if (isRequestProxy) {
      getCustomers().then(res => {
        if (res.data) setCustomers(res.data);
      });
    }
  }, [isRequestProxy]);

  useEffect(() => {
    const handleStorageChange = () => setSelectedId(getAdminPortalCustomerId() || '');
    window.addEventListener('adminPortalCustomerChanged', handleStorageChange);
    return () => window.removeEventListener('adminPortalCustomerChanged', handleStorageChange);
  }, []);

  return (
    <div className="customer-portal-demo-banner info-panel meeting-safety-panel" data-testid={testId} role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      <div>
        <div className="customer-portal-demo-banner-title">
          <span className="status-badge status-badge--open">
            {goLive ? t('customer_live_data_badge') : t('customer_portal_live_badge')}
          </span>
        </div>
        <p>{goLive ? t('customer_portal_golive_message') : t('customer_portal_live_safety_message')}</p>
      </div>

      {isRequestProxy && (
        <div style={{ minWidth: '250px', background: 'var(--tgd-surface)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--tgd-border-color)' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--tgd-muted-text)' }}>Admin: Select Customer View</label>
          <select 
            className="form-control" 
            style={{ padding: '4px 8px', fontSize: '14px', height: 'auto' }}
            value={selectedId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedId(val);
              setAdminPortalCustomerId(val || null);
            }}
          >
            <option value="">-- All Customers --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.customer_name} ({c.customer_code})</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

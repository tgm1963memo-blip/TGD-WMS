import { useNavigate } from 'react-router-dom';
import { BarcodeInputPlaceholder } from '../../components/barcode/BarcodeInputPlaceholder.jsx';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function ReceivingPage() {
  const t = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="page-shell">
      <PageHeader
        title={t('receiving') || 'Receiving'}
        description={t('customer_owned_inventory') || 'Customer-owned inventory'}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/customer/deposit-request')}
          >
            + สร้างใบแจ้งฝาก
          </button>
        }
      />
      <SectionCard title={t('scan_barcode') || 'Scan Barcode'} description={t('premium_dashboard') || 'Premium dashboard'}>
        <BarcodeInputPlaceholder />
      </SectionCard>
    </section>
  );
}

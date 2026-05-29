import { BarcodeInputPlaceholder } from '../../components/barcode/BarcodeInputPlaceholder.jsx';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function TransferPage() {
  const t = useTranslation();

  return (
    <section className="page-shell">
      <PageHeader title={t('transfer') || 'Transfer'} description={t('source_location') || 'Source Location'} />
      <SectionCard title={t('scan_location') || 'Scan Location'} description={t('system_status') || 'System Status'}>
        <BarcodeInputPlaceholder />
      </SectionCard>
    </section>
  );
}

import { BarcodeInputPlaceholder } from '../../components/barcode/BarcodeInputPlaceholder.jsx';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function PickingPage() {
  const t = useTranslation();

  return (
    <section className="page-shell">
      <PageHeader title={t('picking') || 'Picking'} description={t('picking_task') || 'Picking Task'} />
      <SectionCard title={t('scan_pallet') || 'Scan Pallet'} description={t('view_details') || 'View details'}>
        <BarcodeInputPlaceholder />
      </SectionCard>
    </section>
  );
}

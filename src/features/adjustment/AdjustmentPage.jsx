import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function AdjustmentPage() {
  const t = useTranslation();

  return (
    <section className="page-shell">
      <PageHeader title={t('adjustment') || 'Adjustment'} description={t('review_required') || 'Review Required'} />
      <SectionCard title={t('operation_status') || 'Operation Status'} description={t('review_required') || 'Review Required'} tone="warning">
        <p>{t('preview_only') || 'Preview only'}</p>
      </SectionCard>
    </section>
  );
}

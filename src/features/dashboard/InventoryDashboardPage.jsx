import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../../config/pageShellPresentation.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { DashboardInventorySection } from './DashboardInventorySection.jsx';

export function InventoryDashboardPage() {
  const t = useTranslation();

  return (
    <section className={getPageShellClassName('page-shell dashboard-page')}>
      <PageHeader
        title={t('dashboard_inventory_section_title') || 'Inventory Overview'}
        description={t('stock_balance')}
      />
      <DashboardInventorySection />
    </section>
  );
}

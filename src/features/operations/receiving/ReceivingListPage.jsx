import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerDepositNotificationsSection } from '../../../components/customer/CustomerDepositNotificationsSection.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPageShellClassName, isProductionPresentationActive } from '../../../config/pageShellPresentation.js';
import { getReceivingDocuments } from '../../../services/receivingService.js';
import { useTranslation } from '../../../i18n/languageProvider.jsx';



export function ReceivingListPage() {
  const t = useTranslation();
  const goLive = isProductionPresentationActive();
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    // Only kept for potential future use or to avoid empty useEffect
  }, []);

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title={t('receiving') || 'Receiving'}
        description={goLive ? t('receiving_list_description_golive') : t('receiving_customer_deposit_section_hint')}
      />

      {!goLive ? (
        <section className="warning-panel meeting-safety-panel" data-testid="receiving-source-document-guidance" role="status">
          <p>{t('receiving_source_document_guidance')}</p>
        </section>
      ) : null}

      <CustomerDepositNotificationsSection />


    </section>
  );
}

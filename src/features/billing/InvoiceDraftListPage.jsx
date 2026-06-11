import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DashboardSection } from '../../components/dashboard/DashboardSection.jsx';
import { InvoiceDraftFilterPanel } from '../../components/billing/InvoiceDraftFilterPanel.jsx';
import { InvoiceDraftListTable } from '../../components/billing/InvoiceDraftListTable.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { listBillingInvoiceDrafts } from '../../services/billingInvoiceDraftService.js';
import { getCustomers } from '../../services/masterDataService.js';

export function InvoiceDraftListPage() {
  const { language } = useLanguage();
  const [filters, setFilters] = useState({});
  const [customers, setCustomers] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getCustomers().then((result) => {
      if (isMounted) setCustomers(result.data ?? []);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    listBillingInvoiceDrafts({
      customerId: filters.customerId || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }).then((result) => {
      if (!isMounted) return;
      setDrafts(result.data ?? []);
      setError(result.error ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [filters.customerId, filters.status, filters.dateFrom, filters.dateTo]);

  const filteredDrafts = useMemo(() => {
    const draftNo = String(filters.draftNo ?? '').trim().toLowerCase();
    if (!draftNo) return drafts;
    return drafts.filter((draft) => String(draft.draft_no ?? '').toLowerCase().includes(draftNo));
  }, [drafts, filters.draftNo]);

  return (
    <section className="page-shell" data-testid="billing-invoice-drafts-page">
      <PageHeader
        title={getTranslation('billing_invoice_drafts', language) || 'Billing Invoice Drafts'}
        description={getTranslation('billing_invoice_drafts_description', language) || 'Review invoice draft headers created from billing movement weight rows.'}
      />

      <div className="section-card" style={{ marginBottom: 16, padding: 12, background: '#fff8e8', border: '1px solid var(--tgd-primary-gold)' }}>
        <strong>Gate 3B-4 Readiness Preview</strong>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          Invoice drafts can be reviewed and approved from the detail page. Export to Bplus is not enabled yet.
        </p>
      </div>

      <InvoiceDraftFilterPanel value={filters} onChange={setFilters} customers={customers} />

      <DashboardSection title="Invoice Draft List">
        <InvoiceDraftListTable data={filteredDrafts} loading={loading} error={error} />
      </DashboardSection>
    </section>
  );
}

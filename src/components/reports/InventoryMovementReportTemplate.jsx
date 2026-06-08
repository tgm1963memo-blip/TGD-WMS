import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getDefaultDocumentBranding } from '../../config/documentBrandingConfig.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { ReportMetaGrid } from './ReportMetaGrid.jsx';
import { ReportSignatureSection } from './ReportSignatureSection.jsx';

export function InventoryMovementReportTemplate({
  data,
  language = 'th',
  branding = getDefaultDocumentBranding(),
}) {
  const t = (key, fallback) => getTranslation(key, language) || fallback;

  const metaFields = [
    { label: t('customer', 'Customer'), value: data?.customer },
    { label: t('report_address', 'Address'), value: data?.address },
    { label: t('report_month', 'Report Month'), value: data?.reportMonth },
    { label: t('date_from', 'Date From'), value: data?.dateFrom },
    { label: t('date_to', 'Date To'), value: data?.dateTo },
    { label: t('report_issued_date', 'Issued Date'), value: data?.issuedDate },
  ];

  return (
    <article className="operational-report operational-report-a4" data-testid="inventory-movement-report-template">
      <DocumentHeader
        branding={branding}
        language={language}
        documentTitle={t('entry_delivery_inventory_report', 'Entry-Delivery Inventory Report')}
        documentNo={data?.reportMonth !== '-' ? data?.reportMonth : undefined}
        documentDate={data?.issuedDate}
      />

      <ReportMetaGrid fields={metaFields} />

      <section className="operational-report-section">
        <h2 className="operational-report-section-title">{t('movement_ledger', 'Movement Ledger')}</h2>
        <table className="operational-report-table tgd-table">
          <thead>
            <tr>
              <th>{t('date', 'Date')}</th>
              <th>{t('report_received_date', 'Received Date')}</th>
              <th>{t('report_delivery_date', 'Delivery Date')}</th>
              <th>{t('lot', 'Lot No')}</th>
              <th>{t('report_customer_product', 'Customer Product')}</th>
              <th>{t('report_desc_code', 'Desc / Code')}</th>
              <th>{t('report_weight_kg', 'Weight (kg)')}</th>
              <th>{t('report_balance_forward', 'Balance Forward')}</th>
              <th>{t('report_received', 'Received')}</th>
              <th>{t('report_delivery', 'Delivery')}</th>
              <th>{t('report_balance', 'Balance')}</th>
              <th>{t('report_volume_unit', 'Volume Unit')}</th>
              <th>{t('report_remark', 'Remark')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.lines ?? []).map((line) => (
              <tr key={line.id}>
                <td>{line.date}</td>
                <td>{line.receivedDate}</td>
                <td>{line.deliveryDate}</td>
                <td>{line.lotNo}</td>
                <td>{line.customerProduct}</td>
                <td>{line.descCode}</td>
                <td>{line.weightKg}</td>
                <td>{line.balanceForward}</td>
                <td>{line.received}</td>
                <td>{line.delivery}</td>
                <td>{line.balance}</td>
                <td>{line.volumeUnit}</td>
                <td>{line.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="operational-report-totals" data-testid="report-totals-section">
        <div><span>{t('report_subtotal_received', 'Subtotal Received')}</span><strong>{data?.subtotalReceived ?? 0}</strong></div>
        <div><span>{t('report_subtotal_delivery', 'Subtotal Delivery')}</span><strong>{data?.subtotalDelivery ?? 0}</strong></div>
        <div><span>{t('report_subtotal_weight', 'Subtotal Weight')}</span><strong>{data?.subtotalWeight ?? 0}</strong></div>
        <div><span>{t('report_total_received', 'Total Received')}</span><strong>{data?.totalReceived ?? 0}</strong></div>
        <div><span>{t('report_total_delivery', 'Total Delivery')}</span><strong>{data?.totalDelivery ?? 0}</strong></div>
        <div><span>{t('report_total_weight', 'Total Weight')}</span><strong>{data?.totalWeight ?? 0}</strong></div>
      </section>

      <ReportSignatureSection branding={branding} language={language} />
    </article>
  );
}

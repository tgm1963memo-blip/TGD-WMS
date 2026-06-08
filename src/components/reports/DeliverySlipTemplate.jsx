import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getDefaultDocumentBranding } from '../../config/documentBrandingConfig.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { ReportMetaGrid } from './ReportMetaGrid.jsx';
import { ReportSignatureSection } from './ReportSignatureSection.jsx';

export function DeliverySlipTemplate({
  data,
  language = 'th',
  branding = getDefaultDocumentBranding(),
}) {
  const t = (key, fallback) => getTranslation(key, language) || fallback;

  const metaFields = [
    { label: t('report_customer_name', 'Customer Name'), value: data?.customerName },
    { label: t('report_address', 'Address'), value: data?.address },
    { label: t('report_delivery_to', 'Delivery To'), value: data?.deliveryTo },
    { label: t('report_room_temperature', 'Room Temperature'), value: data?.roomTemperature },
    { label: t('report_truck_temperature', 'Truck Temperature'), value: data?.truckTemperature },
    { label: t('document_no', 'Document No'), value: data?.documentNo },
    { label: t('document_date', 'Document Date'), value: data?.documentDate },
    { label: t('report_start_time', 'Start Time'), value: data?.startTime },
    { label: t('report_finish_time', 'Finish Time'), value: data?.finishTime },
    { label: t('report_remark', 'Remark'), value: data?.remark },
  ];

  return (
    <article className="operational-report operational-report-a4" data-testid="delivery-slip-template">
      <DocumentHeader
        branding={branding}
        language={language}
        documentTitle={t('delivery_slip_report', 'Delivery Slip')}
        documentNo={data?.documentNo}
        documentDate={data?.documentDate}
      />

      <ReportMetaGrid fields={metaFields} />

      <section className="operational-report-section">
        <h2 className="operational-report-section-title">{t('document_lines', 'Lines')}</h2>
        <table className="operational-report-table tgd-table">
          <thead>
            <tr>
              <th>{t('lot', 'Lot No')}</th>
              <th>{t('location', 'Location')}</th>
              <th>{t('report_customer_product', 'Customer Product')}</th>
              <th>{t('report_item_code', 'Item Code')}</th>
              <th>{t('report_batch_no', 'Batch No')}</th>
              <th>{t('report_total_weight_kg', 'Total Weight (kg)')}</th>
              <th>{t('report_balance_total', 'Balance Total')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.lines ?? []).map((line) => (
              <tr key={line.id}>
                <td>{line.lotNo}</td>
                <td>{line.location}</td>
                <td>{line.customerProduct}</td>
                <td>{line.itemCode}</td>
                <td>{line.batchNo}</td>
                <td>{line.totalWeightKg}</td>
                <td>{line.balanceTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="operational-report-totals" data-testid="report-totals-section">
        <div><span>{t('report_total_weight_kg', 'Total Weight (kg)')}</span><strong>{data?.totalWeightKg ?? 0}</strong></div>
        <div><span>{t('report_balance_total', 'Balance Total')}</span><strong>{data?.balanceTotal ?? 0}</strong></div>
      </section>

      <ReportSignatureSection branding={branding} language={language} />
    </article>
  );
}

import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getDefaultDocumentBranding } from '../../config/documentBrandingConfig.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { ReportMetaGrid } from './ReportMetaGrid.jsx';
import { ReportSignatureSection } from './ReportSignatureSection.jsx';

export function ReceivingReportTemplate({
  data,
  language = 'th',
  branding = getDefaultDocumentBranding(),
}) {
  const t = (key, fallback) => getTranslation(key, language) || fallback;
  const normalizedBranding = typeof branding === 'object' && !branding?.company_name 
    ? { ...getDefaultDocumentBranding(), ...branding } 
    : branding;

  const metaFields = [
    { label: t('report_customer_name', 'Customer Name'), value: data?.customerName },
    { label: t('report_address', 'Address'), value: data?.address },
    { label: t('report_attention', 'Attention / Contact'), value: data?.attention },
    { label: t('report_receive_date', 'Receive Date'), value: data?.receiveDate },
    { label: t('report_arrival_time', 'Arrival Time'), value: data?.arrivalTime },
    { label: t('report_start_time', 'Start Time'), value: data?.startTime },
    { label: t('report_finish_time', 'Finish Time'), value: data?.finishTime },
    { label: t('report_goods_temp', 'Goods Temp'), value: data?.goodsTemp },
    { label: t('report_truck_temp', 'Truck / Container Temp'), value: data?.truckTemp },
    { label: t('report_truck_no', 'Truck / Container No'), value: data?.truckNo },
    { label: t('report_seal_no', 'Seal No'), value: data?.sealNo },
    { label: t('report_receive_from', 'Receive From'), value: data?.receiveFrom },
    { label: t('report_remark', 'Remark'), value: data?.remark },
  ];

  return (
    <article className="operational-report operational-report-a4" data-testid="receiving-report-template">
      <DocumentHeader
        branding={normalizedBranding}
        language={language}
        documentTitle={t('receiving_information_report', 'Receiving Information')}
        documentNo={data?.documentNo}
        documentDate={data?.receiveDate}
      />

      <ReportMetaGrid fields={metaFields} />

      <section className="operational-report-section">
        <h2 className="operational-report-section-title">{t('document_lines', 'Lines')}</h2>
        <table className="operational-report-table tgd-table">
          <style dangerouslySetInnerHTML={{ __html: `
            .operational-report-table.tgd-table th,
            .operational-report-table.tgd-table td {
              padding: 16px 12px;
            }
          `}} />
          <thead>
            <tr>
              <th>{t('lot', 'Lot No')}</th>
              <th>{t('report_customer_product', 'Customer Product')}</th>
              <th>{t('report_code', 'Code')}</th>
              <th>{t('quantity', 'Qty')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.lines ?? []).map((line) => (
              <tr key={line.id}>
                <td>{line.lotNo}</td>
                <td>{line.customerProduct}</td>
                <td>{line.code}</td>
                <td>{line.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="operational-report-totals" data-testid="report-totals-section">
        <div><span>{t('report_total_qty', 'Total Qty')}</span><strong>{data?.totalQty ?? 0}</strong></div>
        <div><span>{t('weight', 'Total Weight')}</span><strong>{data?.totalWeight ?? 0}</strong></div>
      </section>

      <ReportSignatureSection 
        branding={normalizedBranding} 
        language={language} 
        preparedBy={data?.preparedBy}
        approvedBy={data?.approvedBy}
        receivedByLabel="ISSUED / CHECKED BY"
        deliveredByLabel="APPROVED BY"
      />
    </article>
  );
}

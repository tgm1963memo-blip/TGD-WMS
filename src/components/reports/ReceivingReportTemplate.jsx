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

  const NCOLS = 4;

  return (
    <article className="operational-report operational-report-a4" data-testid="receiving-report-template" style={{ padding: 0 }}>
      {/* One-time header + full meta block — appears only on page 1, does
          NOT repeat on continuation pages (only the slim identifier row
          inside the table's thead below does). */}
      <div style={{ padding: '8mm', borderBottom: '2px solid #ddd' }}>
        <DocumentHeader
          branding={normalizedBranding}
          language={language}
          documentTitle={t('receiving_information_report', 'Receiving Information')}
          documentNo={data?.documentNo}
          documentDate={data?.receiveDate}
        />
        <ReportMetaGrid fields={metaFields} />
        <h2 style={{ fontSize: 13, margin: '8px 0 4px', borderTop: '1px solid #eee', paddingTop: 8 }}>
          {t('document_lines', 'Lines')}
        </h2>
      </div>

      <table className="operational-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '15%' }} />
          <col style={{ width: '40%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>

        <thead>
          {/* Slim identifier row — repeats on every printed page */}
          <tr>
            <td colSpan={NCOLS} className="operational-report-running-header">
              {t('document_no', 'Document No')} {data?.documentNo} &nbsp;•&nbsp; {t('report_customer_name', 'Customer')} {data?.customerName}
            </td>
          </tr>
          {/* Column headers */}
          <tr>
            <th style={{ border: '1px solid #bbb', padding: '6px 8px', background: '#f0f0f0', fontSize: 11, fontWeight: 700 }}>
              {t('lot', 'Lot No')}
            </th>
            <th style={{ border: '1px solid #bbb', padding: '6px 8px', background: '#f0f0f0', fontSize: 11, fontWeight: 700 }}>
              {t('report_customer_product', 'Customer Product')}
            </th>
            <th style={{ border: '1px solid #bbb', padding: '6px 8px', background: '#f0f0f0', fontSize: 11, fontWeight: 700 }}>
              {t('report_code', 'Code')}
            </th>
            <th style={{ border: '1px solid #bbb', padding: '6px 8px', background: '#f0f0f0', fontSize: 11, fontWeight: 700 }}>
              {t('quantity', 'Qty')}
            </th>
          </tr>
        </thead>

        <tbody>
          {(data?.lines ?? []).map((line) => (
            <tr key={line.id}>
              <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: 11, overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{line.lotNo}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: 11, overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{line.customerProduct}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: 11, overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{line.code}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 8px', fontSize: 11, overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{line.qty}</td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={NCOLS} style={{ border: 'none', padding: '8px' }}>
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
            </td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}

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

  const NCOLS = 7;
  const TH = { border: '1px solid #bbb', padding: '6px 8px', background: '#f0f0f0', fontSize: 11, fontWeight: 700 };
  const TD = { border: '1px solid #bbb', padding: '6px 8px', fontSize: 11 };

  return (
    <article className="operational-report operational-report-a4" data-testid="delivery-slip-template" style={{ padding: 0 }}>
      {/* One-time header + full meta block — appears only on page 1, does
          NOT repeat on continuation pages (only the slim identifier row
          inside the table's thead below does). */}
      <div style={{ padding: '8mm', borderBottom: '2px solid #ddd' }}>
        <DocumentHeader
          branding={branding}
          language={language}
          documentTitle={t('delivery_slip_report', 'Delivery Slip')}
          documentNo={data?.documentNo}
          documentDate={data?.documentDate}
        />
        <ReportMetaGrid fields={metaFields} />
        <h2 style={{ fontSize: 13, margin: '8px 0 4px', borderTop: '1px solid #eee', paddingTop: 8 }}>
          {t('document_lines', 'Lines')}
        </h2>
      </div>

      <table className="operational-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '10%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
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
            <th style={TH}>{t('lot', 'Lot No')}</th>
            <th style={TH}>{t('location', 'Location')}</th>
            <th style={TH}>{t('report_customer_product', 'Customer Product')}</th>
            <th style={TH}>{t('report_item_code', 'Item Code')}</th>
            <th style={TH}>{t('report_batch_no', 'Batch No')}</th>
            <th style={{ ...TH, textAlign: 'right' }}>{t('report_total_weight_kg', 'Total Weight (kg)')}</th>
            <th style={{ ...TH, textAlign: 'right' }}>{t('report_balance_total', 'Balance Total')}</th>
          </tr>
        </thead>

        <tbody>
          {(data?.lines ?? []).map((line) => (
            <tr key={line.id}>
              <td style={TD}>{line.lotNo}</td>
              <td style={TD}>{line.location}</td>
              <td style={TD}>{line.customerProduct}</td>
              <td style={TD}>{line.itemCode}</td>
              <td style={TD}>{line.batchNo}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{line.totalWeightKg}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{line.balanceTotal}</td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={NCOLS} style={{ border: 'none', padding: '8px' }}>
              <section className="operational-report-totals" data-testid="report-totals-section">
                <div>
                  <span>{t('report_total_weight_kg', 'Total Weight (kg)')}</span>
                  <strong>{data?.totalWeightKg ?? 0}</strong>
                </div>
                <div>
                  <span>{t('report_balance_total', 'Balance Total')}</span>
                  <strong>{data?.balanceTotal ?? 0}</strong>
                </div>
              </section>
              <ReportSignatureSection branding={branding} language={language} />
            </td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}

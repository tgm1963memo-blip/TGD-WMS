import { getTranslation } from '../../i18n/translationCatalog.js';
import { ReportSignatureSection } from './ReportSignatureSection.jsx';
import { normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';

function fmtNum(v, decimals = 3) {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0
    ? n.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : '-';
}

function fmtQty(v) {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? String(n) : '-';
}

export function InventoryMovementReportTemplate({
  data,
  language = 'th',
  branding,
  customerDetails
}) {
  const t = (key, fallback) => getTranslation(key, language) || fallback;
  const normalizedBranding = normalizeDocumentBrandingConfig(branding || {});

  const metaFields = [
    { label: t('customer', 'Customer'), value: data?.customer },
    { label: t('report_address', 'Address'), value: data?.address },
    { label: t('report_month', 'For Month'), value: data?.reportMonth },
    { label: t('date_from', 'Date From'), value: data?.dateFrom },
    { label: t('date_to', 'Date To'), value: data?.dateTo },
    { label: t('report_issued_date', 'Issued Date'), value: data?.issuedDate },
  ];

  const lines = data?.lines ?? [];

  const subTotalReceivedVol = lines.reduce((s, l) => s + (Number(l.receivedVolume) || 0), 0);
  const subTotalReceivedWt = lines.reduce((s, l) => s + (Number(l.receivedWeight) || 0), 0);
  const subTotalDeliveryVol = lines.reduce((s, l) => s + (Number(l.deliveryVolume) || 0), 0);
  const subTotalDeliveryWt = lines.reduce((s, l) => s + (Number(l.deliveryWeight) || 0), 0);

  return (
    <article className="operational-report operational-report-a4-landscape" data-testid="inventory-movement-report-template">
      {/* Custom Header Layout to match Image 2 with TG Cold Logo */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        {normalizedBranding.logo_url && (
          <img src={normalizedBranding.logo_url} alt="Logo" style={{ height: 60 }} />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            CUSTOMER: {data?.customer}
          </div>
          <div style={{ marginBottom: 4 }}>
            ADDRESS : {data?.address || '-'}
          </div>
          <div style={{ marginBottom: 4 }}>
            TEL : {customerDetails?.phone || '-'} &nbsp;&nbsp;&nbsp;&nbsp; FAX : {customerDetails?.fax || '-'}
          </div>
          <div>
            ATTN : {customerDetails?.contact_name || '-'}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
          <div style={{ marginBottom: 4 }}>
            FOR MONTH : {data?.dateFrom} - {data?.dateTo}
          </div>
          <div>
            ISSUED DATE : {data?.issuedDate}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', marginBottom: 16, borderBottom: '1px solid #ccc', paddingBottom: 8 }}>
        Entry-Delivery Inventory Report
      </div>

      <section className="operational-report-section">
        <div style={{ overflowX: 'auto' }}>
          <table className="operational-report-table tgd-table" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ textAlign: 'center' }}>{t('date', 'DATE')}</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>{t('report_received_date', 'RECEIVED\nDATE')}</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>{t('report_delivery_date', 'DELIVERY\nDATE')}</th>
                <th rowSpan={2}>{t('lot', 'LOT-NO')}</th>
                <th rowSpan={2}>{t('report_customer_product', 'CUSTOMER PRODUCT')}</th>
                <th rowSpan={2}>{t('report_desc_code', 'DESC.')}</th>
                <th rowSpan={2} style={{ textAlign: 'right' }}>{t('report_weight_kg', 'WEIGHT\nKG.')}</th>
                <th colSpan={2} style={{ textAlign: 'center', background: '#e8eaf6' }}>{t('report_balance_forward', 'BALANCE FORWARD')}</th>
                <th colSpan={2} style={{ textAlign: 'center', background: '#e8f5e9' }}>{t('report_received', 'RECEIVED')}</th>
                <th colSpan={2} style={{ textAlign: 'center', background: '#fce4ec' }}>{t('report_delivery', 'DELIVERY')}</th>
                <th colSpan={2} style={{ textAlign: 'center', background: '#fff9e6' }}>{t('report_balance', 'BALANCE')}</th>
                <th rowSpan={2} style={{ textAlign: 'center' }}>{t('report_volume_unit', 'VOLUME\nUNIT')}</th>
                <th rowSpan={2}>{t('report_remark', 'REMARK')}</th>
              </tr>
              <tr>
                <th style={{ textAlign: 'center', background: '#e8eaf6' }}>VOLUME</th>
                <th style={{ textAlign: 'right', background: '#e8eaf6' }}>TOTAL WEIGHT<br />(KG)</th>
                <th style={{ textAlign: 'center', background: '#e8f5e9' }}>VOLUME</th>
                <th style={{ textAlign: 'right', background: '#e8f5e9' }}>TOTAL WEIGHT<br />(KG)</th>
                <th style={{ textAlign: 'center', background: '#fce4ec' }}>VOLUME</th>
                <th style={{ textAlign: 'right', background: '#fce4ec' }}>TOTAL WEIGHT<br />(KG)</th>
                <th style={{ textAlign: 'center', background: '#fff9e6' }}>VOLUME</th>
                <th style={{ textAlign: 'right', background: '#fff9e6' }}>TOTAL WEIGHT<br />(KG)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td style={{ textAlign: 'center' }}>{line.date}</td>
                  <td style={{ textAlign: 'center' }}>{line.receivedDate}</td>
                  <td style={{ textAlign: 'center' }}>{line.deliveryDate}</td>
                  <td>{line.lotNo}</td>
                  <td>{line.customerProduct}</td>
                  <td>{line.descCode}</td>
                  <td style={{ textAlign: 'right' }}>{fmtNum(line.weightKg)}</td>
                  <td style={{ textAlign: 'center', background: '#f3f4fd' }}>{fmtQty(line.balanceForwardVolume)}</td>
                  <td style={{ textAlign: 'right', background: '#f3f4fd' }}>{fmtNum(line.balanceForwardWeight)}</td>
                  <td style={{ textAlign: 'center', background: '#f1f8f2' }}>{fmtQty(line.receivedVolume)}</td>
                  <td style={{ textAlign: 'right', background: '#f1f8f2' }}>{fmtNum(line.receivedWeight)}</td>
                  <td style={{ textAlign: 'center', background: '#fdf2f5' }}>{fmtQty(line.deliveryVolume)}</td>
                  <td style={{ textAlign: 'right', background: '#fdf2f5' }}>{fmtNum(line.deliveryWeight)}</td>
                  <td style={{ textAlign: 'center', background: '#fffbf0' }}>{fmtQty(line.balanceVolume)}</td>
                  <td style={{ textAlign: 'right', background: '#fffbf0' }}>{fmtNum(line.balanceWeight)}</td>
                  <td style={{ textAlign: 'center' }}>{line.volumeUnit}</td>
                  <td>{line.remark}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
                <td colSpan={7} style={{ textAlign: 'right' }}>SUB TOTAL ({lines.length})</td>
                <td style={{ textAlign: 'center', background: '#e8eaf6' }}>-</td>
                <td style={{ textAlign: 'right', background: '#e8eaf6' }}>-</td>
                <td style={{ textAlign: 'center', background: '#e8f5e9' }}>{fmtQty(subTotalReceivedVol) !== '-' ? subTotalReceivedVol : '-'}</td>
                <td style={{ textAlign: 'right', background: '#e8f5e9' }}>{fmtNum(subTotalReceivedWt)}</td>
                <td style={{ textAlign: 'center', background: '#fce4ec' }}>{fmtQty(subTotalDeliveryVol) !== '-' ? subTotalDeliveryVol : '-'}</td>
                <td style={{ textAlign: 'right', background: '#fce4ec' }}>{fmtNum(subTotalDeliveryWt)}</td>
                <td colSpan={2} style={{ background: '#fff9e6' }} />
                <td colSpan={2} />
              </tr>
              <tr style={{ fontWeight: 700, background: '#ebebeb' }}>
                <td colSpan={7} style={{ textAlign: 'right' }}>TOTAL</td>
                <td style={{ textAlign: 'center', background: '#e8eaf6' }}>{fmtQty(data?.totalBalanceForwardVolume)}</td>
                <td style={{ textAlign: 'right', background: '#e8eaf6' }}>{fmtNum(data?.totalBalanceForwardWeight)}</td>
                <td style={{ textAlign: 'center', background: '#e8f5e9' }}>{data?.totalReceived ?? fmtQty(subTotalReceivedVol)}</td>
                <td style={{ textAlign: 'right', background: '#e8f5e9' }}>{fmtNum(data?.totalReceivedWeight ?? subTotalReceivedWt)}</td>
                <td style={{ textAlign: 'center', background: '#fce4ec' }}>{data?.totalDelivery ?? fmtQty(subTotalDeliveryVol)}</td>
                <td style={{ textAlign: 'right', background: '#fce4ec' }}>{fmtNum(data?.totalDeliveryWeight ?? subTotalDeliveryWt)}</td>
                <td style={{ textAlign: 'center', background: '#fff9e6' }}>{fmtQty(data?.totalBalanceVolume)}</td>
                <td style={{ textAlign: 'right', background: '#fff9e6' }}>{fmtNum(data?.totalBalanceWeight)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <ReportSignatureSection branding={branding} language={language} />
    </article>
  );
}

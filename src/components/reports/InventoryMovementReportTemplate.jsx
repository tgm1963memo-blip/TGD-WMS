import { getTranslation } from '../../i18n/translationCatalog.js';
import { ReportSignatureSection } from './ReportSignatureSection.jsx';
import { normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';

function fmtDate(v) {
  if (!v || v === '-') return '-';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return v;
}

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

const CELL = { border: '1px solid #bbb', padding: '3px 4px', verticalAlign: 'middle' };
const TH = { ...CELL, background: '#f0f0f0', fontWeight: 700, fontSize: 8 };

const COL_WIDTHS = [
  '3%',   // NO
  '7%',   // RECEIVED DATE
  '7%',   // DELIVERY DATE
  '4%',   // LOT
  '12%',  // CUSTOMER PRODUCT
  '7%',   // DESC/CODE
  '5%',   // WEIGHT KG
  '5%',   // BF VOLUME
  '6%',   // BF WEIGHT
  '5%',   // RCV VOLUME
  '6%',   // RCV WEIGHT
  '5%',   // DLV VOLUME
  '6%',   // DLV WEIGHT
  '5%',   // BAL VOLUME
  '6%',   // BAL WEIGHT
  '4%',   // UNIT
  '7%',   // REMARK
];

const NCOLS = COL_WIDTHS.length;

export function InventoryMovementReportTemplate({
  data,
  language = 'th',
  branding,
  customerDetails,
  printedBy,
}) {
  const t = (key, fallback) => getTranslation(key, language) || fallback;
  const normalizedBranding = normalizeDocumentBrandingConfig(branding || {});
  const lines = data?.lines ?? [];

  const subTotalReceivedVol = lines.reduce((s, l) => s + (Number(l.receivedVolume) || 0), 0);
  const subTotalReceivedWt  = lines.reduce((s, l) => s + (Number(l.receivedWeight) || 0), 0);
  const subTotalDeliveryVol = lines.reduce((s, l) => s + (Number(l.deliveryVolume) || 0), 0);
  const subTotalDeliveryWt  = lines.reduce((s, l) => s + (Number(l.deliveryWeight) || 0), 0);

  const headerTd = {
    ...CELL,
    border: 'none',
    borderBottom: '2px solid #ccc',
    padding: '6px 8px',
  };

  return (
    <article
      className="operational-report operational-report-a4-landscape"
      data-testid="inventory-movement-report-template"
      style={{ padding: 0 }}
    >
      {/*
        Single table wrapping everything so <thead> (logo + customer info + column headers)
        repeats on EVERY printed page automatically.
      */}
      <table
        className="report-print-table"
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: 9,
        }}
      >
        {/* Column widths */}
        <colgroup>
          {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>

        {/* ── THEAD: repeats on every page ── */}
        <thead>
          {/* Row 1: Logo + Customer info */}
          <tr>
            <td colSpan={NCOLS} style={headerTd}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {normalizedBranding.logo_url && (
                    <img src={normalizedBranding.logo_url} alt="Logo" style={{ height: 44, marginBottom: 4 }} />
                  )}
                  <div style={{ fontWeight: 'bold', fontSize: 10 }}>CUSTOMER: {data?.customer}</div>
                  <div style={{ fontSize: 9 }}>ADDRESS : {data?.address || '-'}</div>
                  <div style={{ fontSize: 9 }}>
                    TEL : {customerDetails?.phone || '-'} &nbsp;&nbsp; FAX : {customerDetails?.fax || '-'}
                  </div>
                  <div style={{ fontSize: 9 }}>ATTN : {customerDetails?.contact_name || '-'}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 10 }}>
                  <div>FOR MONTH : {fmtDate(data?.dateFrom)} - {fmtDate(data?.dateTo)}</div>
                  <div>ISSUED DATE : {fmtDate(data?.issuedDate)}</div>
                </div>
              </div>
              <div style={{
                textAlign: 'center', fontSize: 13, fontWeight: 'bold',
                marginTop: 6, borderTop: '1px solid #ccc', paddingTop: 5,
              }}>
                Entry-Delivery Inventory Report
              </div>
            </td>
          </tr>

          {/* Row 2: Column headers (group labels) */}
          <tr>
            <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>NO.</th>
            <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>วันที่<br />รับเข้า</th>
            <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>วันที่<br />จ่ายออก</th>
            <th rowSpan={2} style={{ ...TH }}>รายละเอียด/<br />รหัส</th>
            <th rowSpan={2} style={{ ...TH }}>สินค้าลูกค้า</th>
            <th rowSpan={2} style={{ ...TH }}>ล๊อต</th>
            <th rowSpan={2} style={{ ...TH, textAlign: 'right' }}>น้ำหนัก<br />(กก.)</th>
            <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#e8eaf6' }}>ยอดยกมา</th>
            <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#e8f5e9' }}>รับเข้า</th>
            <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#fce4ec' }}>จ่ายออก</th>
            <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#fff9e6' }}>คงเหลือ</th>
            <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>UNIT</th>
            <th rowSpan={2} style={{ ...TH }}>หมายเหตุ</th>
          </tr>

          {/* Row 3: Sub-column headers */}
          <tr>
            <th style={{ ...TH, textAlign: 'center', background: '#e8eaf6' }}>VOL</th>
            <th style={{ ...TH, textAlign: 'right', background: '#e8eaf6' }}>WT (KG)</th>
            <th style={{ ...TH, textAlign: 'center', background: '#e8f5e9' }}>VOL</th>
            <th style={{ ...TH, textAlign: 'right', background: '#e8f5e9' }}>WT (KG)</th>
            <th style={{ ...TH, textAlign: 'center', background: '#fce4ec' }}>VOL</th>
            <th style={{ ...TH, textAlign: 'right', background: '#fce4ec' }}>WT (KG)</th>
            <th style={{ ...TH, textAlign: 'center', background: '#fff9e6' }}>VOL</th>
            <th style={{ ...TH, textAlign: 'right', background: '#fff9e6' }}>WT (KG)</th>
          </tr>
        </thead>

        {/* ── TBODY: data rows ── */}
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={NCOLS} style={{ ...CELL, textAlign: 'center', color: '#888', padding: '16px' }}>
                ไม่มีข้อมูล
              </td>
            </tr>
          ) : lines.map((line, index) => (
            <tr key={line.id ?? index} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
              <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{index + 1}</td>
              <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{fmtDate(line.receivedDate)}</td>
              <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{fmtDate(line.deliveryDate)}</td>
              <td style={{ ...CELL, fontSize: 8 }}>{line.descCode}</td>
              <td style={{ ...CELL, fontSize: 8 }}>{line.customerProduct}</td>
              <td style={{ ...CELL, fontSize: 8 }}>{line.lotNo}</td>
              <td style={{ ...CELL, textAlign: 'right', fontSize: 8 }}>{fmtNum(line.weightKg)}</td>
              <td style={{ ...CELL, textAlign: 'center', background: '#f3f4fd', fontSize: 8 }}>{fmtQty(line.balanceForwardVolume)}</td>
              <td style={{ ...CELL, textAlign: 'right',  background: '#f3f4fd', fontSize: 8 }}>{fmtNum(line.balanceForwardWeight)}</td>
              <td style={{ ...CELL, textAlign: 'center', background: '#f1f8f2', fontSize: 8 }}>{fmtQty(line.receivedVolume)}</td>
              <td style={{ ...CELL, textAlign: 'right',  background: '#f1f8f2', fontSize: 8 }}>{fmtNum(line.receivedWeight)}</td>
              <td style={{ ...CELL, textAlign: 'center', background: '#fdf2f5', fontSize: 8 }}>{fmtQty(line.deliveryVolume)}</td>
              <td style={{ ...CELL, textAlign: 'right',  background: '#fdf2f5', fontSize: 8 }}>{fmtNum(line.deliveryWeight)}</td>
              <td style={{ ...CELL, textAlign: 'center', background: '#fffbf0', fontSize: 8 }}>{fmtQty(line.balanceVolume)}</td>
              <td style={{ ...CELL, textAlign: 'right',  background: '#fffbf0', fontSize: 8 }}>{fmtNum(line.balanceWeight)}</td>
              <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{line.volumeUnit}</td>
              <td style={{ ...CELL, fontSize: 8 }}>{line.remark}</td>
            </tr>
          ))}
        </tbody>

        {/* ── TFOOT: sub-totals + grand total + signatures ── */}
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td colSpan={7} style={{ ...CELL, textAlign: 'right', fontSize: 8 }}>
              SUB TOTAL ({lines.length})
            </td>
            <td style={{ ...CELL, textAlign: 'center', background: '#e8eaf6', fontSize: 8 }}>-</td>
            <td style={{ ...CELL, textAlign: 'right',  background: '#e8eaf6', fontSize: 8 }}>-</td>
            <td style={{ ...CELL, textAlign: 'center', background: '#e8f5e9', fontSize: 8 }}>{subTotalReceivedVol || '-'}</td>
            <td style={{ ...CELL, textAlign: 'right',  background: '#e8f5e9', fontSize: 8 }}>{fmtNum(subTotalReceivedWt)}</td>
            <td style={{ ...CELL, textAlign: 'center', background: '#fce4ec', fontSize: 8 }}>{subTotalDeliveryVol || '-'}</td>
            <td style={{ ...CELL, textAlign: 'right',  background: '#fce4ec', fontSize: 8 }}>{fmtNum(subTotalDeliveryWt)}</td>
            <td style={{ ...CELL, background: '#fff9e6' }} colSpan={2} />
            <td colSpan={2} style={CELL} />
          </tr>
          <tr style={{ fontWeight: 700, background: '#ebebeb' }}>
            <td colSpan={7} style={{ ...CELL, textAlign: 'right', fontSize: 8 }}>TOTAL</td>
            <td style={{ ...CELL, textAlign: 'center', background: '#e8eaf6', fontSize: 8 }}>{fmtQty(data?.totalBalanceForwardVolume)}</td>
            <td style={{ ...CELL, textAlign: 'right',  background: '#e8eaf6', fontSize: 8 }}>{fmtNum(data?.totalBalanceForwardWeight)}</td>
            <td style={{ ...CELL, textAlign: 'center', background: '#e8f5e9', fontSize: 8 }}>{data?.totalReceived ?? fmtQty(subTotalReceivedVol)}</td>
            <td style={{ ...CELL, textAlign: 'right',  background: '#e8f5e9', fontSize: 8 }}>{fmtNum(data?.totalReceivedWeight ?? subTotalReceivedWt)}</td>
            <td style={{ ...CELL, textAlign: 'center', background: '#fce4ec', fontSize: 8 }}>{data?.totalDelivery ?? fmtQty(subTotalDeliveryVol)}</td>
            <td style={{ ...CELL, textAlign: 'right',  background: '#fce4ec', fontSize: 8 }}>{fmtNum(data?.totalDeliveryWeight ?? subTotalDeliveryWt)}</td>
            <td style={{ ...CELL, textAlign: 'center', background: '#fff9e6', fontSize: 8 }}>{fmtQty(data?.totalBalanceVolume)}</td>
            <td style={{ ...CELL, textAlign: 'right',  background: '#fff9e6', fontSize: 8 }}>{fmtNum(data?.totalBalanceWeight)}</td>
            <td colSpan={2} style={CELL} />
          </tr>
          <tr>
            <td colSpan={NCOLS} style={{ ...CELL, border: 'none', paddingTop: 16 }}>
              <ReportSignatureSection branding={branding} language={language} preparedBy={printedBy} />
            </td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}

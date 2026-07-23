import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient.js';
import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';
import { buildInvoiceLotLedger } from '../../utils/invoiceLotLedgerUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';
import { insertSoftBreaks } from '../../utils/textWrapUtils.js';

function fmt(value) {
  if (value == null) return '-';
  return formatFixed2(value);
}

// Thai text commonly has no natural word-break points, so a long product
// name can overflow its cell instead of wrapping even with overflow-wrap
// set — inserts a soft-break every `chunkSize` GRAPHEME clusters (not raw
// characters), so a break never lands between a base consonant and its
// combining tone/vowel mark. Same helper/pattern used by the deposit and
// withdrawal print documents.
function fmtWrap(value, chunkSize = 10) {
  if (value == null || value === '') return '-';
  return insertSoftBreaks(String(value), chunkSize);
}

function fmtQty(value) {
  if (value == null || value === 0) return '-';
  return Number(value).toLocaleString('th-TH');
}

function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMonthYear(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

const TH = { border: '1px solid #cbd5e1', padding: '4px 5px', background: '#f1fdf4', fontSize: 9, fontWeight: 700, textAlign: 'center' };
const TD = { border: '1px solid #e5e7eb', padding: '4px 5px', fontSize: 9, textAlign: 'center', verticalAlign: 'middle', overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'normal' };

// A customer's contact/address details aren't denormalized onto the draft
// header (only customer_name is) — fetched separately here so this
// component stays self-contained and neither caller (InvoiceDraftDetailPage
// / InvoiceDraftListPage) needs its own plumbing just for print.
function useCustomerContact(customerId) {
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    let active = true;
    if (!customerId || !supabase) { setCustomer(null); return undefined; }
    supabase
      .from('tgd_customers')
      .select('customer_name, address, phone, contact_name')
      .eq('id', customerId)
      .maybeSingle()
      .then(({ data }) => { if (active) setCustomer(data ?? null); });
    return () => { active = false; };
  }, [customerId]);

  return customer;
}

export function InvoiceDraftPrintTemplate({ draft, lines = [] }) {
  const customer = useCustomerContact(draft?.customer_id);
  if (!draft) return null;

  const branding = normalizeDocumentBrandingConfig(getDefaultDocumentBranding());
  const { lots, grandTotal } = buildInvoiceLotLedger(lines);

  return (
    <div className="operational-report operational-report-a4-landscape" style={{ fontSize: 13, color: '#1e293b' }}>

      {/* ── Cover: company + document identity ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #2d9348' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2d9348', letterSpacing: '-0.5px' }}>{branding.company_name_en || 'TGD Cold Storage'}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{branding.company_name_th}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, maxWidth: 340 }}>{branding.company_address_th}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            {branding.phone ? `โทร ${branding.phone}` : null}
            {branding.tax_id ? ` เลขประจำตัวผู้เสียภาษี ${branding.tax_id}` : null}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>ใบแจ้งหนี้ (ร่าง) / INVOICE (DRAFT)</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2d9348', marginTop: 4 }}>{draft.draft_no}</div>
          <table style={{ marginTop: 8, marginLeft: 'auto', fontSize: 11 }}>
            <tbody>
              <tr><td style={{ color: '#64748b', paddingRight: 10, textAlign: 'right' }}>REF NO</td><td style={{ fontWeight: 600 }}>{draft.internal_reference || draft.draft_no}</td></tr>
              <tr><td style={{ color: '#64748b', paddingRight: 10, textAlign: 'right' }}>FOR MONTH</td><td style={{ fontWeight: 600 }}>{fmtMonthYear(draft.billing_period_start)}</td></tr>
              <tr><td style={{ color: '#64748b', paddingRight: 10, textAlign: 'right' }}>ISSUED DATE</td><td style={{ fontWeight: 600 }}>{fmtDate(draft.created_at)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Customer block ── */}
      <table style={{ marginBottom: 16, fontSize: 12, width: '60%' }}>
        <tbody>
          <tr><td style={{ color: '#64748b', paddingRight: 10, width: 90 }}>CUSTOMER</td><td style={{ fontWeight: 700 }}>{draft.customer_name ?? customer?.customer_name ?? '-'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 10 }}>ADDRESS</td><td>{customer?.address ?? '-'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 10 }}>TEL</td><td>{customer?.phone ?? '-'}</td></tr>
          <tr><td style={{ color: '#64748b', paddingRight: 10 }}>ATTN</td><td>{customer?.contact_name ?? '-'}</td></tr>
        </tbody>
      </table>

      {/* ── Detailed per-lot ledger: balance forward -> received -> delivery
          -> balance, walked chronologically per lot, matching the format of
          a customer-provided reference invoice. Our storage-charge engine
          resolves one amount per lot for the whole billing period (not
          repeating sub-periods), so that charge is shown on each lot's last
          event row rather than split into fabricated sub-period rows. ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '5%' }} /> {/* received date */}
          <col style={{ width: '5%' }} /> {/* delivery date */}
          <col style={{ width: '7%' }} /> {/* lot no */}
          <col style={{ width: '11%' }} /> {/* customer product */}
          <col style={{ width: '6%' }} /> {/* desc / internal code */}
          <col style={{ width: '5%' }} /> {/* weight/unit */}
          <col style={{ width: '5%' }} /> {/* bal fwd volume */}
          <col style={{ width: '5%' }} /> {/* bal fwd weight */}
          <col style={{ width: '5%' }} /> {/* received volume */}
          <col style={{ width: '5%' }} /> {/* received weight */}
          <col style={{ width: '5%' }} /> {/* delivery volume */}
          <col style={{ width: '5%' }} /> {/* delivery weight */}
          <col style={{ width: '5%' }} /> {/* balance volume */}
          <col style={{ width: '5%' }} /> {/* balance weight */}
          <col style={{ width: '5%' }} /> {/* handling fee rate */}
          <col style={{ width: '5%' }} /> {/* handling fee */}
          <col style={{ width: '5%' }} /> {/* cold storage charge */}
          <col style={{ width: '6%' }} /> {/* total */}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={TH}>RECEIVED<br />DATE</th>
            <th rowSpan={2} style={TH}>DELIVERY<br />DATE</th>
            <th rowSpan={2} style={TH}>LOT NO</th>
            <th rowSpan={2} style={TH}>CUSTOMER PRODUCT</th>
            <th rowSpan={2} style={TH}>DESC</th>
            <th rowSpan={2} style={TH}>WT/UNIT<br />(KG)</th>
            <th colSpan={2} style={TH}>BALANCE FORWARD</th>
            <th colSpan={2} style={TH}>RECEIVED</th>
            <th colSpan={2} style={TH}>DELIVERY</th>
            <th colSpan={2} style={TH}>BALANCE</th>
            <th rowSpan={2} style={TH}>HANDLING<br />FEE RATE</th>
            <th rowSpan={2} style={TH}>HANDLING<br />FEE</th>
            <th rowSpan={2} style={TH}>COLD STORAGE<br />CHARGE</th>
            <th rowSpan={2} style={TH}>TOTAL</th>
          </tr>
          <tr>
            <th style={TH}>VOL.</th>
            <th style={TH}>WT(KG)</th>
            <th style={TH}>VOL.</th>
            <th style={TH}>WT(KG)</th>
            <th style={TH}>VOL.</th>
            <th style={TH}>WT(KG)</th>
            <th style={TH}>VOL.</th>
            <th style={TH}>WT(KG)</th>
          </tr>
        </thead>
        <tbody>
          {lots.length ? lots.map((lot) => (
            <Fragment key={lot.key}>
              {lot.rows.map((row, i) => (
                <tr key={`${lot.key}-${i}`}>
                  <td style={TD}>{i === 0 ? fmtDate(row.receivedDate) : ''}</td>
                  <td style={TD}>{fmtDate(row.deliveryDate)}</td>
                  <td style={{ ...TD, textAlign: 'left' }}>{i === 0 ? row.lotNo ?? '-' : ''}</td>
                  <td style={{ ...TD, textAlign: 'left' }} title={row.productName ?? row.productCode ?? '-'}>{i === 0 ? fmtWrap(row.productName ?? row.productCode) : ''}</td>
                  <td style={TD}>{i === 0 ? row.productCode ?? '-' : ''}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{row.weightPerUnit != null ? fmt(row.weightPerUnit) : '-'}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(row.balanceForwardVolume)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{fmt(row.balanceForwardWeight)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(row.receivedVolume)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{row.receivedWeight ? fmt(row.receivedWeight) : '-'}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(row.deliveryVolume)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{row.deliveryWeight ? fmt(row.deliveryWeight) : '-'}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{fmtQty(row.balanceVolume)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{fmt(row.balanceWeight)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{row.rate != null ? fmt(row.rate) : '-'}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{row.handlingFee != null ? fmt(row.handlingFee) : '-'}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{row.coldStorageCharge != null ? fmt(row.coldStorageCharge) : '-'}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{row.total != null ? fmt(row.total) : '-'}</td>
                </tr>
              ))}
              <tr style={{ background: '#f8fafb', fontWeight: 700 }}>
                <td colSpan={6} style={{ ...TD, textAlign: 'right' }}>SUB TOTAL ({lot.lotNo ?? '-'})</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(lot.subtotal.balanceForwardVolume)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmt(lot.subtotal.balanceForwardWeight)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(lot.subtotal.receivedVolume)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmt(lot.subtotal.receivedWeight)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(lot.subtotal.deliveryVolume)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmt(lot.subtotal.deliveryWeight)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(lot.subtotal.balanceVolume)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmt(lot.subtotal.balanceWeight)}</td>
                <td style={TD} />
                <td style={{ ...TD, textAlign: 'right' }}>{fmt(lot.subtotal.handlingFee)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmt(lot.subtotal.coldStorageCharge)}</td>
                <td style={{ ...TD, textAlign: 'right' }}>{fmt(lot.subtotal.total)}</td>
              </tr>
            </Fragment>
          )) : (
            <tr>
              <td colSpan={18} style={{ ...TD, padding: 16, color: '#94a3b8' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
        {lots.length > 0 && (
          <tfoot>
            <tr style={{ background: '#f1fdf4', fontWeight: 700 }}>
              <td colSpan={6} style={{ ...TD, textAlign: 'right' }}>GRAND TOTAL</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(grandTotal.balanceForwardVolume)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmt(grandTotal.balanceForwardWeight)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(grandTotal.receivedVolume)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmt(grandTotal.receivedWeight)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(grandTotal.deliveryVolume)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmt(grandTotal.deliveryWeight)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmtQty(grandTotal.balanceVolume)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmt(grandTotal.balanceWeight)}</td>
              <td style={TD} />
              <td style={{ ...TD, textAlign: 'right' }}>{fmt(grandTotal.handlingFee)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmt(grandTotal.coldStorageCharge)}</td>
              <td style={{ ...TD, textAlign: 'right', color: '#2d9348' }}>{fmt(grandTotal.total)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* ── Amount summary — our system doesn't track a separate VAT/tax
          amount on the draft header, so this shows the computed total only
          rather than fabricating a tax breakdown we have no real figure
          for. ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, fontWeight: 800, borderTop: '2px solid #1e293b' }}>
            <span>ยอดรวมทั้งสิ้น / NET TOTAL</span>
            <span style={{ color: '#2d9348' }}>{fmt(draft.total_amount)} {draft.currency ?? 'THB'}</span>
          </div>
        </div>
      </div>

      {/* ── Signature block — matches the reference's 4-role sign-off ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20, marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb', fontSize: 11 }}>
        {[
          ['ผู้รับบริการ', 'Receiver'],
          ['ผู้ส่งของ', 'Delivered By'],
          ['ผู้ตรวจสอบ', 'Approved By'],
          ['ผู้มีอำนาจกระทำการแทนบริษัท', 'Authorized Signatory'],
        ].map(([th, en]) => (
          <div key={en}>
            <div style={{ borderBottom: '1px solid #cbd5e1', height: 40 }} />
            <div style={{ color: '#64748b', marginTop: 4 }}>{th} / {en}</div>
            <div style={{ color: '#94a3b8', marginTop: 4 }}>วันที่ / Date ____________</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
        เอกสารนี้เป็นร่างเท่านั้น — This is a draft document only
        {draft.note ? <div style={{ marginTop: 4 }}>หมายเหตุ: {draft.note}</div> : null}
      </div>
    </div>
  );
}

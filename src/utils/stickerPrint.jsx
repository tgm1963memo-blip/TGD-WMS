import QRCode from 'react-qr-code';
import { renderToStaticMarkup } from 'react-dom/server';

// Template matches the physical label TGC already prints: rounded box,
// date top-right, then customer/product/LOT/storage/qty/allergen/mfg date/
// location, with "เลขที่สินค้า TGC" replaced by the generated tracking code.
export function formatStickerDate(iso) {
  if (!iso) return '-';
  const s = String(iso).split('T')[0];
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
}

export function printSticker({
  depositDate, customerName, productCode, productName, lotNo,
  storageLabel, quantityLabel, allergenLabel, mfgDate, locationCode, trackingCode,
}) {
  const field = (label, value, opts = {}) => `
    <div class="d-field${opts.wide ? ' d-field--wide' : ''}">
      <span class="d-label">${label}</span>
      <span class="d-value">${value ?? '-'}</span>
    </div>`;

  // The QR encodes just the bare tracking code (no JSON) so scanning it during
  // picking can match a withdrawal line by a simple string lookup.
  const qrSvg = renderToStaticMarkup(
    <QRCode value={trackingCode || ''} size={140} style={{ width: '100%', height: 'auto' }} />
  );

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sticker</title>
<style>
  /* Printing goes to whatever paper is actually loaded (A4/Letter on a
     regular printer), not a dedicated 3x4in thermal label roll — the label
     is meant to fill that entire sheet, so size: landscape just picks the
     rotation that matches the landscape layout below and lets the printer's
     own paper size stand; there is no more fixed physical footprint to fight. */
  @page { size: landscape; margin: 6mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { height: 100%; }
  body { font-family: 'TH Sarabun New', 'Sarabun', 'Leelawadee UI', Tahoma, sans-serif; font-size: 15px; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  /* Sticker fills the full page/window on both screen and print — no more
     fixed mm box that left blank paper around a small label-sized rectangle. */
  .sticker-page { width: 100%; height: 100vh; }
  .sticker {
    width: 100%; height: 100%; box-sizing: border-box;
    border: 6px solid #000; border-radius: 10mm; padding: 8mm 14mm;
    display: flex; flex-direction: column; gap: 4mm; overflow: hidden;
  }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0; }
  /* font-weight alone isn't reliably bold once the browser/printer substitutes
     a fallback Latin font (the Thai-first font stack above may not carry a
     true black weight for Latin/numerals/dates) — a text stroke guarantees a
     visibly heavier, legible stroke on an actual print regardless of which
     font actually gets used to render it. Applied to every text element on
     the label, not just the tracking code, after a real print test came back
     with the smaller detail fields too thin/faint to read even though the
     CSS already said font-weight:700. */
  .date-field { font-size: 28px; font-weight: 700; line-height: 1.25; -webkit-text-stroke: 0.4px #000; }
  .qr-box svg { width: 40mm; height: 40mm; display: block; }
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14mm; flex: 1; min-height: 0; overflow: hidden; }
  .d-field { display: flex; flex-direction: column; border-bottom: 2px dotted #999; line-height: 1.1; padding-bottom: 1mm; }
  .d-field--wide { grid-column: 1 / -1; }
  .d-label { font-weight: 700; font-size: 18px; color: #555; -webkit-text-stroke: 0.2px #555; }
  .d-value { font-weight: 900; font-size: 32px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; -webkit-text-stroke: 0.5px #000; }
  /* Tracking code is the whole reason for this label: the single biggest,
     boldest element, spanning the full width on one line — the code is
     always a fixed 11 characters (2-letter prefix + YYMMDD + 3-digit
     sequence, see tgd_generate_deposit_line_tracking_code), so a single
     large size can be sized to always fit without wrapping. */
  .code-block { flex-shrink: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 8mm; border-top: 4px solid #000; padding-top: 3mm; margin-top: auto; }
  .code-label { font-size: 26px; font-weight: 700; color: #333; -webkit-text-stroke: 0.3px #333; }
  .code-value { font-size: 130px; font-weight: 900; letter-spacing: -0.5px; line-height: 1; white-space: nowrap; -webkit-text-stroke: 1.2px #000; }
</style>
</head>
<body>
<div class="sticker-page">
  <div class="sticker">
    <div class="top-row">
      <div class="date-field">วันที่ฝากเข้า<br>${formatStickerDate(depositDate)}</div>
      <div class="qr-box">${qrSvg}</div>
    </div>
    <div class="details">
      ${field('ชื่อลูกค้า', customerName, { wide: true })}
      ${field('รหัสสินค้า', productCode)}
      ${field('Lot (ของลูกค้า)', lotNo)}
      ${field('ชื่อสินค้า', productName, { wide: true })}
      ${field('การจัดเก็บ', storageLabel)}
      ${field('จำนวน', quantityLabel)}
      ${field('สารก่อภูมิแพ้ (Allergen)', allergenLabel, { wide: true })}
      ${field('วันผลิต', formatStickerDate(mfgDate))}
      ${field('Location', locationCode || '-')}
    </div>
    <div class="code-block">
      <div class="code-label">Tracking Code</div>
      <div class="code-value">${trackingCode || '-'}</div>
    </div>
  </div>
</div>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=1000,height=760');
  if (!win) { alert('กรุณาอนุญาตป๊อปอัพ'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 500); };
}

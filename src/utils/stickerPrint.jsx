import QRCode from 'react-qr-code';
import { renderToStaticMarkup } from 'react-dom/server';

// Simplified label: date top-right + QR, then just product name/Location/
// quantity, with the tracking code as the single big, bold focal element
// at the bottom — trimmed down from the earlier 9-field version (customer
// name, product code, lot, storage type, allergen, mfg date all dropped)
// so the tracking code gets more of the label's area to itself.
export function formatStickerDate(iso) {
  if (!iso) return '-';
  const s = String(iso).split('T')[0];
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
}

export function printSticker({
  depositDate, productName, quantityLabel, locationCode, trackingCode,
}) {
  const field = (label, value, opts = {}) => `
    <div class="d-field${opts.wide ? ' d-field--wide' : ''}">
      <span class="d-label">${label}</span>
      <span class="d-value">${value ?? '-'}</span>
    </div>`;

  // The QR encodes just the bare tracking code (no JSON) so scanning it during
  // picking can match a withdrawal line by a simple string lookup.
  const qrSvg = renderToStaticMarkup(
    <QRCode value={trackingCode || ''} size={72} style={{ width: '100%', height: 'auto' }} />
  );

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sticker</title>
<style>
  /* This label always prints on a dedicated thermal roll (confirmed on a
     real Honeywell PM42 with 4x3in stock) — not general office paper — so
     the page must stay pinned to that true physical size. No fixed @page
     size: forcing a custom page size that doesn't match whatever paper/label
     stock is actually loaded is what made printers auto-rotate and
     scale-to-fit (blurry, sideways output). Leaving size unset lets the
     print dialog use the printer's own configured media — the sticker
     itself stays a fixed physical size below, so it prints true-size.
     margin: 0 — an 8mm page margin was insetting the whole label away from
     the physical edges, leaving blank paper border around it on the actual
     print instead of the label filling the page. The label's own border/
     radius already provides visual breathing room, so the page itself
     should have none. */
  @page { margin: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'TH Sarabun New', 'Sarabun', 'Leelawadee UI', Tahoma, sans-serif; font-size: 15px; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  /* On screen (this preview popup): show the sticker as a plain landscape
     rectangle, unrotated, so what you see here is what the layout actually
     looks like — easy to check before printing.
     When printing: the physical label roll is still 3in wide x 4in long
     (76.2mm x 101.6mm) — a previous attempt at this label declared the
     sticker itself 101.6mm wide (assuming a 4x3in roll) and it printed
     truncated because the real print head is only 76.2mm wide (see
     "sticker is 3x4in (portrait)" fix in git history). So for print we keep
     the outer page at the true 76.2mm x 101.6mm footprint and rotate the
     landscape content 90deg to fit inside it sideways — nothing in the
     print job is ever wider than the print head. Turn the printed label a
     quarter turn to read it; if it comes out rotated the wrong way on your
     printer, flip the sign on "rotate(90deg)" below to -90deg. */
  .sticker-page { width: 101.6mm; height: 76.2mm; }
  .sticker {
    width: 100%; height: 100%; box-sizing: border-box;
    border: 3px solid #000; border-radius: 4mm; padding: 1.2mm 2.5mm;
    display: flex; flex-direction: column; gap: 0.6mm; overflow: hidden;
  }
  @media print {
    .sticker-page { width: 76.2mm; height: 101.6mm; overflow: hidden; position: relative; }
    .sticker {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(90deg);
      width: 101.6mm; height: 76.2mm;
    }
  }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0; }
  /* font-weight alone isn't reliably bold once the browser/printer substitutes
     a fallback Latin font (the Thai-first font stack above may not carry a
     true black weight for Latin/numerals/dates) — a text stroke guarantees a
     visibly heavier, legible stroke on an actual thermal-label print
     regardless of which font actually gets used to render it. Applied to
     every text element on the label, not just the tracking code, after a
     real print test came back with the smaller detail fields too thin/faint
     to read even though the CSS already said font-weight:700. */
  .date-field { font-size: 13px; font-weight: 700; line-height: 1.2; -webkit-text-stroke: 0.2px #000; }
  .qr-box svg { width: 13mm; height: 13mm; display: block; }
  /* Only 3 fields left (product name spans both columns; Location and
     quantity share a row) — most of the label's height now goes to the
     tracking code band below instead of being split across 9 detail rows. */
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 0 4mm; flex-shrink: 0; }
  .d-field { display: flex; flex-direction: column; border-bottom: 1px dotted #999; line-height: 1.15; padding-bottom: 0.3mm; }
  .d-field--wide { grid-column: 1 / -1; }
  .d-label { font-weight: 700; font-size: 9px; color: #555; -webkit-text-stroke: 0.1px #555; }
  .d-value { font-weight: 900; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; -webkit-text-stroke: 0.3px #000; }
  /* Tracking code is the whole reason for this label: the single biggest,
     boldest element, filling nearly the whole width on one line. Label and
     value are stacked (not sharing a row) so the value gets the full
     width — sharing a row with the label previously left it clipping past
     the label's edge. 56px is the largest verified-safe size for an
     11-character code (2-letter prefix + YYMMDD + 3-digit sequence, see
     tgd_generate_deposit_line_tracking_code) at this label's fixed
     101.6mm width — measured against the real font stack with margin to
     spare; do not raise this without re-measuring, since a "would still
     look right" bump has already clipped once (see WHY above). */
  .code-block { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; border-top: 3px solid #000; padding-top: 1.2mm; margin-top: 0.6mm; }
  .code-label { font-size: 14px; font-weight: 700; color: #333; -webkit-text-stroke: 0.2px #333; }
  .code-value { font-size: 56px; font-weight: 900; letter-spacing: -0.5px; line-height: 1; white-space: nowrap; -webkit-text-stroke: 1.2px #000; }
</style>
</head>
<body>
<div class="sticker-page">
  <div class="sticker">
    <div class="top-row">
      <div class="date-field">วันที่รับเข้า<br>${formatStickerDate(depositDate)}</div>
      <div class="qr-box">${qrSvg}</div>
    </div>
    <div class="details">
      ${field('ชื่อสินค้า', productName, { wide: true })}
      ${field('Location', locationCode || '-')}
      ${field('จำนวน', quantityLabel)}
    </div>
    <div class="code-block">
      <div class="code-label">Tracking Code</div>
      <div class="code-value">${trackingCode || '-'}</div>
    </div>
  </div>
</div>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=520,height=380');
  if (!win) { alert('กรุณาอนุญาตป๊อปอัพ'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 500); };
}

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

// Splits the tracking code into two roughly-equal halves so it can print
// across two lines instead of one — halving the characters per line lets
// each line run much larger than a single 11-character line ever could
// within the label's fixed width.
function splitTrackingCode(code) {
  if (!code) return ['-', ''];
  const mid = Math.ceil(code.length / 2);
  return [code.slice(0, mid), code.slice(mid)];
}

export function printSticker({
  depositDate, productName, quantityLabel, locationCode, trackingCode,
}) {

  // The QR encodes just the bare tracking code (no JSON) so scanning it during
  // picking can match a withdrawal line by a simple string lookup.
  const qrSvg = renderToStaticMarkup(
    <QRCode value={trackingCode || ''} size={72} style={{ width: '100%', height: 'auto' }} />
  );

  const [codeLine1, codeLine2] = splitTrackingCode(trackingCode);

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
  /* Thai-capable fonts MUST lead this list. A prior change ("style: use
     Tahoma font on sticker") reordered this to Tahoma-first for a cleaner
     look on the developer's screen, but real thermal-label print drivers
     (confirmed on the warehouse's Honeywell PM42) don't shape/rasterize Thai
     combining vowel/tone marks correctly through Tahoma — printed labels
     came out with tone marks and vowels visibly displaced from their base
     consonant, reading as garbled/wrong characters even though on-screen
     preview looked fine. Leelawadee UI / TH Sarabun New / Sarabun are the
     fonts Windows actually ships with correct Thai shaping tables; keep them
     first and use Tahoma only as a plain-Latin/digit fallback at the end.
     Do not reorder this for cosmetic reasons without re-testing an actual
     print on the physical label printer, not just the screen preview. */
  body { font-family: 'Leelawadee UI', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif; font-size: 15px; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
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
    border: 3px solid #000; border-radius: 4mm; padding: 1mm;
    background-color: white; overflow: hidden; display: flex; flex-direction: column;
  }
  @media print {
    .sticker-page { width: 76.2mm; height: 101.6mm; overflow: hidden; position: relative; }
    .sticker {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(90deg);
      width: 101.6mm; height: 76.2mm;
    }
  }

  /* Table Grid Layout (Minimized White Space) */
  table.layout { width: 100%; height: 100%; border-collapse: collapse; }
  table.layout td { border: 2px solid #000; padding: 0.8mm 1.5mm; overflow: hidden; }
  .qr-cell { width: 22mm; padding: 1mm !important; text-align: center; vertical-align: middle; }
  .qr-cell svg { width: 100%; height: auto; display: block; margin: 0 auto; }

  .product-cell { vertical-align: top; padding-bottom: 1mm !important; }
  .product-flex { display: flex; justify-content: space-between; align-items: flex-start; gap: 2mm; }
  /* No -webkit-text-stroke and no negative letter-spacing here: both distort
     Thai combining vowel/tone marks on real print rasterizers (see the font
     comment on body {} above) — font-weight 700 alone (a real weight most
     Thai-capable fonts ship, unlike a faux/synthetic 900) gives plenty of
     boldness without that risk. */
  .product-name { font-size: 20px; font-weight: 700; line-height: 1.2; }
  .date-block { font-size: 10px; font-weight: 700; line-height: 1.1; text-align: right; flex-shrink: 0; }

  .info-row td { font-size: 16px; font-weight: 700; line-height: 1; text-align: center; vertical-align: middle; }
  .info-label { font-size: 9px; color: #333; display: block; margin-bottom: 1px; }

  .track-row { height: 100%; text-align: center; vertical-align: middle; padding: 0 !important; }
  .track-wrapper { display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; height: 100%; }
  /* Tracking code is maximized to fill the remaining area */
  .track-code { font-family: 'Tahoma', sans-serif; font-size: 94px; font-weight: 900; line-height: 0.85; letter-spacing: -3px; -webkit-text-stroke: 2px #000; margin: 0; padding: 0; white-space: nowrap; }
</style>
</head>
<body>
<div class="sticker-page">
  <div class="sticker">
    <table class="layout">
      <tr>
        <td class="product-cell" colspan="2">
          <div class="product-flex">
            <div class="product-name">${productName || '-'}</div>
            <div class="date-block">วันที่รับเข้า<br>${formatStickerDate(depositDate)}</div>
          </div>
        </td>
        <td class="qr-cell" rowspan="2">${qrSvg}</td>
      </tr>
      <tr class="info-row">
        <td>
          <span class="info-label">Location</span>
          ${locationCode || '-'}
        </td>
        <td>
          <span class="info-label">จำนวน</span>
          ${quantityLabel || '-'}
        </td>
      </tr>
      <tr>
        <td colspan="3" class="track-row">
          <div class="track-wrapper">
            <div class="track-code">${codeLine1}</div>
            <div class="track-code">${codeLine2}</div>
          </div>
        </td>
      </tr>
    </table>
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

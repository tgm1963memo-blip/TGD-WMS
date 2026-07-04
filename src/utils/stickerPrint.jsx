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
    <div class="d-field">
      <span class="d-label">${label}</span>
      <span class="d-value" style="${opts.bold ? 'font-weight:900;' : ''}">${value ?? '-'}</span>
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
  /* No fixed @page size: forcing a custom page size that doesn't match
     whatever paper/label stock is actually loaded is what made printers
     auto-rotate and scale-to-fit (blurry, sideways output). Leaving size
     unset lets the print dialog use the printer's normal paper — the
     sticker itself stays a fixed physical size below, so it prints true-size
     regardless of what paper the printer has loaded. */
  @page { margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'TH Sarabun New', 'Sarabun', 'Leelawadee UI', Tahoma, sans-serif; font-size: 15px; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  /* 3 x 4 inch label (76.2mm x 101.6mm) — media width x length, matching
     the physical label roll. */
  .sticker { border: 3px solid #000; border-radius: 4mm; padding: 2mm 2.5mm; width: 76.2mm; height: 101.6mm; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.8mm; overflow: hidden; }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0; }
  .date-field { font-size: 9px; font-weight: 700; line-height: 1.3; }
  .qr-box svg { width: 15mm; height: 15mm; display: block; }
  .details { display: flex; flex-direction: column; flex-shrink: 0; }
  .d-field { display: flex; align-items: baseline; gap: 5px; border-bottom: 1px dotted #999; line-height: 1.35; }
  .d-label { font-weight: 700; font-size: 8px; white-space: nowrap; color: #333; }
  .d-value { flex: 1; font-weight: 600; font-size: 9px; overflow-wrap: break-word; word-break: break-word; }
  /* Tracking code is the whole reason for this label: make it the single
     biggest, most legible element, pinned bottom-right, so staff never need
     to hand-copy it in marker onto the sticker again. The label is only
     3in wide, so a long code can't stay on one line at a large size —
     wrapping to 2 lines is fine as long as the digits are as big as
     possible (word-break so it wraps by character, not just at spaces). */
  .code-block { margin-top: auto; display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
  .code-label { font-size: 9px; font-weight: 700; color: #333; line-height: 1; }
  .code-value { font-size: 56px; font-weight: 900; letter-spacing: 0.3px; line-height: 1; text-align: right; word-break: break-all; }
</style>
</head>
<body>
<div class="sticker">
  <div class="top-row">
    <div class="date-field">วันที่ฝากเข้า<br>${formatStickerDate(depositDate)}</div>
    <div class="qr-box">${qrSvg}</div>
  </div>
  <div class="details">
    ${field('ชื่อลูกค้า', customerName)}
    ${field('รหัสสินค้า', productCode)}
    ${field('ชื่อสินค้า', productName)}
    ${field('Lot (ของลูกค้า)', lotNo)}
    ${field('การจัดเก็บ', storageLabel)}
    ${field('จำนวน', quantityLabel)}
    ${field('สารก่อภูมิแพ้ (Allergen)', allergenLabel, { bold: true })}
    ${field('วันผลิต', formatStickerDate(mfgDate))}
    ${field('Location', locationCode || '-')}
  </div>
  <div class="code-block">
    <div class="code-label">Tracking Code</div>
    <div class="code-value">${trackingCode || '-'}</div>
  </div>
</div>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=480,height=420');
  if (!win) { alert('กรุณาอนุญาตป๊อปอัพ'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 500); };
}

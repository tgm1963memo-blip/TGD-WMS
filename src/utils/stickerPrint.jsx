import { useState } from 'react';
import QRCode from 'react-qr-code';
import { renderToStaticMarkup } from 'react-dom/server';
import { insertSoftBreaks as withSoftBreaks } from './textWrapUtils.js';

// Simplified label: customer name + date top-right + QR, then just product
// name/Location/quantity, with the tracking code as the single big, bold
// focal element at the bottom, and a blank framed box bottom-right for
// handwritten notes — trimmed down from the earlier 9-field version
// (product code, lot, storage type, allergen, mfg date still dropped) so
// the tracking code keeps most of the label's area to itself.
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

// Builds one <div class="sticker-page">...</div> block for a single item —
// shared by printSticker (one popup, one label) and printStickers (one
// popup, N labels back-to-back, each its own printed page via
// page-break-after so a multi-box deposit line prints one sticker per box
// in a single print job instead of N separate popups).
function renderStickerPageHtml({
  depositDate, customerName, productName, productCode, quantityLabel, locationCode, trackingCode,
}) {
  // The QR encodes just the bare tracking code (no JSON) so scanning it during
  // picking can match a withdrawal line by a simple string lookup.
  const qrSvg = renderToStaticMarkup(
    <QRCode value={trackingCode || ''} size={72} style={{ width: '100%', height: 'auto' }} />
  );

  const [codeLine1, codeLine2] = splitTrackingCode(trackingCode);

  return `<div class="sticker-page">
  <div class="sticker">
    <table class="layout">
      <tr>
        <td class="product-cell" colspan="2">
          <div class="product-flex">
            <!-- The product name already repeats in the bottom info box
                 below, so this large top-left slot shows the customer name
                 instead of duplicating it — the customer name used to only
                 appear small inside .date-block alongside the date. -->
            <div class="product-name">${withSoftBreaks(customerName) || '-'}</div>
            <div class="date-block">
              วันที่รับเข้า<br>${formatStickerDate(depositDate)}
            </div>
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
      <tr>
        <td colspan="3" class="bottom-info-row">
          <div class="bottom-info-box">
            <div class="bottom-product-name">${withSoftBreaks(productName) || '-'}</div>
            <div class="bottom-product-code">${withSoftBreaks(productCode) || '-'}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</div>`;
}

const ROTATION_STORAGE_KEY = 'tgd_sticker_rotation_deg';
// Only the two quarter-turn directions are offered — the sticker content is
// deliberately wider than the physical page (rotated to fit the true
// 76.2mm-wide print head, see the CSS comment below); 0/180 would leave it
// wider than the page instead of fixing anything.
const ROTATION_CYCLE = [90, -90];
const ROTATION_LABELS = { 90: '90° (ค่าเริ่มต้น)', '-90': '-90° (สลับด้าน)' };

// Different physical label printers mount the roll a different way, so the
// rotation the on-screen landscape layout needs to fit the true 76.2mm-wide
// print head isn't the same on every machine — see the comment on
// `rotate(...)` below. This persists a per-browser override so staff
// printing from a different PC/printer than the one this label was
// originally tuned against can fix it themselves without a code change,
// without affecting machines that already print correctly (default stays
// 90deg, the original tuned value).
export function getStickerRotationDeg() {
  const stored = Number(localStorage.getItem(ROTATION_STORAGE_KEY));
  return ROTATION_CYCLE.includes(stored) ? stored : 90;
}

export function setStickerRotationDeg(deg) {
  localStorage.setItem(ROTATION_STORAGE_KEY, String(deg));
}

export function cycleStickerRotationDeg() {
  const current = getStickerRotationDeg();
  const next = ROTATION_CYCLE[(ROTATION_CYCLE.indexOf(current) + 1) % ROTATION_CYCLE.length];
  setStickerRotationDeg(next);
  return next;
}

export function getStickerRotationLabel(deg = getStickerRotationDeg()) {
  return ROTATION_LABELS[deg] ?? `${deg}°`;
}

// Small reusable control to drop next to any sticker-print button — lets
// staff on a machine where labels print rotated/garbled flip through the
// 4 quarter-turn options and immediately see the change reflected on their
// next print, without involving a developer.
export function StickerRotationControl({ style } = {}) {
  const [deg, setDeg] = useState(() => getStickerRotationDeg());
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      title="ถ้าป้ายที่พิมพ์ออกมาบิดเบี้ยว/ผิดด้าน ให้กดปุ่มนี้เพื่อลองหมุนทิศทางใหม่ แล้วพิมพ์อีกครั้ง"
      onClick={() => setDeg(cycleStickerRotationDeg())}
      style={style}
    >
      🔄 การหมุนป้าย: {getStickerRotationLabel(deg)}
    </button>
  );
}

const PAGE_SIZE_STORAGE_KEY = 'tgd_sticker_page_size_mode';
// 'auto' (default): no @page size is declared, so the printer's own
// configured media/label size drives the physical page — correct for the
// machine this label was tuned against. 'fixed': explicitly declare
// `@page { size: 100mm 120mm }` — needed on a printer/driver whose
// configured media doesn't already match the label (still set to the old
// 76.2x101.6mm stock, or a generic default), which otherwise scales/clips
// the 100x120mm content down to whatever smaller page the driver assumes,
// printing content that runs off the physical label's edge.
const PAGE_SIZE_MODES = ['auto', 'fixed'];
const PAGE_SIZE_LABELS = { auto: 'อัตโนมัติ (ค่าเริ่มต้น)', fixed: 'บังคับ 100×120มม.' };

export function getStickerPageSizeMode() {
  const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
  return PAGE_SIZE_MODES.includes(stored) ? stored : 'auto';
}

export function setStickerPageSizeMode(mode) {
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, mode);
}

export function cycleStickerPageSizeMode() {
  const current = getStickerPageSizeMode();
  const next = PAGE_SIZE_MODES[(PAGE_SIZE_MODES.indexOf(current) + 1) % PAGE_SIZE_MODES.length];
  setStickerPageSizeMode(next);
  return next;
}

export function getStickerPageSizeLabel(mode = getStickerPageSizeMode()) {
  return PAGE_SIZE_LABELS[mode] ?? mode;
}

// Pairs with <StickerRotationControl /> — for a printer where labels print
// truncated/run off the edge instead of rotated/garbled, staff flip this to
// force the true label dimensions instead of trusting the driver's own
// (possibly wrong) configured media size.
export function StickerPageSizeControl({ style } = {}) {
  const [mode, setMode] = useState(() => getStickerPageSizeMode());
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      title="ถ้าป้ายที่พิมพ์ออกมาตกขอบ/ถูกตัดขอบ ให้กดปุ่มนี้เพื่อบังคับขนาดหน้ากระดาษ 100×120มม. แล้วพิมพ์อีกครั้ง"
      onClick={() => setMode(cycleStickerPageSizeMode())}
      style={style}
    >
      📐 ขนาดหน้าป้าย: {getStickerPageSizeLabel(mode)}
    </button>
  );
}

function stickerDocumentHtml(pagesHtml, pageCount = 1) {
  // Default ('auto'): no @page size, printer's own configured media drives
  // the physical page (correct on the machine this label was first tuned
  // against — see the comment below). On a different printer whose driver
  // still assumes the old/smaller stock size, forcing the true 100x120mm
  // size here (via <StickerPageSizeControl />) stops it from scaling/
  // clipping the label content down to that wrong assumed page, which is
  // what "prints but runs off the edge" looks like.
  //
  // Forced unconditionally (regardless of the auto/fixed toggle) whenever a
  // job has more than one page: printing ONE sticker never showed this
  // problem on any printer/browser tested, but printing several in the same
  // job — every time, on every machine tried — came out with content
  // bleeding/overlapping between labels. The one thing that's genuinely
  // different about a multi-page job (not just "more of the same") is that
  // every page after the first depends on the browser and the printer
  // driver agreeing on physical page size to start a clean new page at each
  // page-break-after boundary; in 'auto' mode neither side is ever told
  // what that size actually is, so any driver/browser default that isn't
  // exactly 100x120mm compounds page-to-page instead of just being wrong
  // once. Removing that ambiguity for every page in a multi-page job (not
  // only when the user has manually picked 'fixed') is what actually fixes
  // the "1 is fine, N bleeds" symptom without changing single-sticker
  // behavior, which already worked.
  const pageSizeRule = (getStickerPageSizeMode() === 'fixed' || pageCount > 1) ? 'size: 100mm 120mm;' : '';
  return `<!DOCTYPE html>
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
  @page { margin: 0; ${pageSizeRule} }
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
  /* On screen (this preview popup): show each sticker as a plain landscape
     rectangle, unrotated, stacked with a gap — easy to check before
     printing.
     When printing: the physical label roll is 10cm wide x 12cm long
     (100mm x 120mm — sized up from the original 76.2mm x 101.6mm/3x4in
     stock). So for print we keep the outer page at the true 100mm x 120mm
     footprint and rotate the landscape content (120mm x 100mm) 90deg to
     fit inside it sideways — nothing in the print job is ever wider than
     the physical media. Turn the printed label a quarter turn to read it;
     if it comes out rotated the wrong way on a given machine, that's
     per-printer (different label-roll mounting direction), not a code bug
     — the rotation is read from getStickerRotationDeg()/localStorage
     rather than hardcoded, so staff on that machine can flip it via
     <StickerRotationControl /> without touching code.
     Each .sticker-page is also its own printed page (page-break-after),
     so N items print as N sequential labels off the thermal roll instead
     of being squeezed onto one. */
  .sticker-page { width: 120mm; height: 100mm; margin-bottom: 6mm; }
  .sticker {
    width: 100%; height: 100%; box-sizing: border-box;
    border: 3px solid #000; border-radius: 4mm; padding: 1mm;
    background-color: white; overflow: hidden; display: flex; flex-direction: column;
  }
  @media print {
    .sticker-page {
      width: 100mm; height: 120mm; overflow: hidden; position: relative;
      margin: 0; page-break-after: always; break-after: page;
      page-break-inside: avoid; break-inside: avoid;
    }
    .sticker-page:last-child { page-break-after: auto; break-after: auto; }
    .sticker {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(${getStickerRotationDeg()}deg);
      width: 120mm; height: 100mm;
    }
  }

  /* Table Grid Layout (Minimized White Space) */
  table.layout { width: 100%; height: 100%; border-collapse: collapse; }
  /* No overflow:hidden here — this used to silently clip any text field
     (product name, customer name) that didn't fit its cell, losing
     characters instead of wrapping. Rows without a hard-coded height (all
     but .track-row) grow to fit their content in normal table layout, so
     long text just wraps onto more lines and takes the space it needs
     instead of being cut. */
  table.layout td { border: 2px solid #000; padding: 0.8mm 1.5mm; }
  .qr-cell { width: 22mm; padding: 1mm !important; text-align: center; vertical-align: middle; }
  .qr-cell svg { width: 100%; height: auto; display: block; margin: 0 auto; }

  .product-cell { vertical-align: top; padding-bottom: 1mm !important; }
  .product-flex { display: flex; justify-content: space-between; align-items: flex-start; gap: 2mm; }
  /* No -webkit-text-stroke and no negative letter-spacing here: both distort
     Thai combining vowel/tone marks on real print rasterizers (see the font
     comment on body {} above) — font-weight 700 alone (a real weight most
     Thai-capable fonts ship, unlike a faux/synthetic 900) gives plenty of
     boldness without that risk. */
  /* overflow-wrap/word-break on every free-text field below: Thai text
     commonly has no spaces between words, so without an explicit break
     point a long product/customer name has nowhere to wrap — it either
     overflows its box (bleeding into neighboring cells) or gets silently
     clipped, both of which read as "missing"/garbled text on the printed
     label. */
  /* flex: 1 1 <basis> + min-width: 0 on BOTH sides — .date-block used to
     have flex-shrink:0, so the flex box gave it its full intrinsic
     (unwrapped) width no matter what, leaving almost nothing for the
     customer name on the left; with word-break:break-word and no room
     left, that squeezed it down to one character per line, reading as
     "text falling/missing" on the printed label. Giving each side a
     guaranteed basis share (and min-width:0, since flex items otherwise
     refuse to shrink below their own content's natural minimum) makes both
     sides wrap within their own share instead of one crowding the other
     out. 65/35 (not an even split) because the left slot holds the
     customer name — usually the longer string — while the right slot is
     now just a short fixed-format date. */
  .product-name { font-size: 20px; font-weight: 700; line-height: 1.2; overflow-wrap: break-word; word-break: break-word; flex: 1 1 65%; min-width: 0; }
  .date-block { font-size: 10px; font-weight: 700; line-height: 1.1; text-align: right; flex: 1 1 35%; min-width: 0; overflow-wrap: break-word; word-break: break-word; }

  .info-row td { font-size: 16px; font-weight: 700; line-height: 1; text-align: center; vertical-align: middle; }
  .info-label { font-size: 9px; color: #333; display: block; margin-bottom: 1px; }

  .track-row { height: 100%; text-align: center; vertical-align: middle; padding: 0 !important; }
  .track-wrapper { display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; height: 100%; }
  /* Tracking code is maximized to fill the remaining area */
  .track-code { font-family: 'Tahoma', sans-serif; font-size: 94px; font-weight: 900; line-height: 0.85; letter-spacing: -3px; -webkit-text-stroke: 2px #000; margin: 0; padding: 0; white-space: nowrap; }

  /* Framed box across the bottom — repeats product name + product code
     large enough to read without hunting for the small top-left copy,
     since the tracking code below it is what's usually scanned/matched
     first and the product identity easily gets overlooked otherwise. No
     fixed height/overflow:hidden — a long product name wraps onto more
     lines and the row grows to fit rather than clipping it, trading a
     little of the tracking code's space for never losing text. */
  .bottom-info-row { border: none !important; padding: 0.5mm 0 !important; }
  .bottom-info-box {
    margin: 0 1.5mm; box-sizing: border-box;
    border: 1.5px solid #000; border-radius: 1mm;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    padding: 1mm 2mm;
  }
  .bottom-product-name { font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; overflow-wrap: break-word; word-break: break-word; }
  .bottom-product-code { font-size: 12px; font-weight: 600; color: #333; line-height: 1.1; margin-top: 0.5mm; text-align: center; overflow-wrap: break-word; word-break: break-word; }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

// Shrinks the popup to the actual rendered content size (plus the browser's
// own chrome — title bar/borders — measured from the gap between outerWidth
// and innerWidth) instead of leaving it at a fixed guessed size that left a
// large blank margin around a single sticker. Capped to a fraction of the
// screen's available height so a large bulk print job doesn't try to open a
// window taller than the screen — that content still shows, just scrolled.
function fitPopupToContent(win) {
  try {
    const rect = win.document.body.getBoundingClientRect();
    const chromeWidth = Math.max(0, win.outerWidth - win.innerWidth);
    const chromeHeight = Math.max(0, win.outerHeight - win.innerHeight);
    const maxHeight = (win.screen?.availHeight || 900) * 0.9;
    const targetWidth = Math.ceil(rect.width) + chromeWidth + 4;
    const targetHeight = Math.min(Math.ceil(rect.height) + chromeHeight + 4, maxHeight);
    win.resizeTo(targetWidth, targetHeight);
  } catch {
    // resizeTo can be blocked by some browsers/extensions on a
    // non-user-sized popup — the preview still works at its opened size.
  }
}

function openAndPrintHtml(html, pageCount = 1) {
  // Opened small — fitPopupToContent resizes it to the actual rendered
  // sticker size once loaded, rather than guessing a fixed size up front
  // (which previously left a large blank margin around a single sticker).
  const win = window.open('', '_blank', 'width=500,height=400');
  if (!win) { alert('กรุณาอนุญาตป๊อปอัพ'); return; }
  win.document.write(html);
  win.document.close();
  // A fixed 500ms delay was tuned against a single label — printing many
  // stickers in one job means many more table rows/QR SVGs to lay out
  // before the page is actually ready, so print() could fire mid-layout on
  // a slower shop-floor PC and send an incomplete/truncated job to the
  // printer. Scale the delay with the page count (with a floor of 500ms so
  // a single sticker isn't slowed down) rather than assuming one size fits
  // every batch size.
  const delay = Math.max(500, pageCount * 120);
  win.onload = () => {
    fitPopupToContent(win);
    setTimeout(() => win.print(), delay);
  };
}

export function printSticker({
  depositDate, customerName, productName, productCode, quantityLabel, locationCode, trackingCode,
}) {
  const html = stickerDocumentHtml(renderStickerPageHtml({
    depositDate, customerName, productName, productCode, quantityLabel, locationCode, trackingCode,
  }));
  openAndPrintHtml(html, 1);
}

// items: [{ depositDate, productName, quantityLabel, locationCode, trackingCode }]
// Prints every item as its own page in ONE print job/popup, in the order
// given — used for "print stickers for selected lines" bulk actions.
export function printStickers(items = []) {
  if (!items.length) return;
  const html = stickerDocumentHtml(items.map((item) => renderStickerPageHtml(item)).join('\n'), items.length);
  openAndPrintHtml(html, items.length);
}

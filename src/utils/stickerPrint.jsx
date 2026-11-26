import { useState } from 'react';
import QRCode from 'react-qr-code';
import { renderToStaticMarkup } from 'react-dom/server';
import { insertSoftBreaks as withSoftBreaks } from './textWrapUtils.js';
import { buildPalletCode } from './locationCodeUtils.js';
import { OSWALD_BOLD_SUBSET_WOFF2_DATA_URI } from '../assets/fonts/OswaldBoldSubset.js';

// Simplified label: customer name + date top-right + QR, then just product
// name/Location/quantity, with the tracking code as the single big, bold
// focal element at the bottom, and a blank framed box bottom-right for
// handwritten notes — trimmed down from the earlier 9-field version
// (product code, lot, storage type, mfg date still dropped) so the tracking
// code keeps most of the label's area to itself. Allergen was dropped too,
// then reinstated as a warning line in the product-name box — food-safety
// info a handler needs to see, not one to trade away for layout space.
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
  depositDate, customerName, productName, productCode, quantityLabel, locationCode, trackingCode, allergenLabel,
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
            ${allergenLabel ? `<div class="bottom-allergen-warning">⚠ สารก่อภูมิแพ้: ${withSoftBreaks(allergenLabel)}</div>` : ''}
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
    /* Centers the rotated .sticker via flexbox on the page, NOT via
       position:absolute + top/left:50% + translate(-50%,-50%) — that
       combination is what this replaced, and it broke on every page
       except the very last one in a multi-sticker job. Confirmed with a
       real multi-page render (Chromium print/PDF pipeline): each
       page-break-after:always fragment mis-resolved the absolutely-
       positioned child's percentage top/left against the wrong
       containing block, so every page but the last printed with its
       border cut off, the QR code missing, and overlapping/garbled text
       — exactly the "last one is fine, the rest bleed outside the form"
       symptom reported by staff. Flexbox centering has no percentage-
       offset resolution step to get wrong, so every page (not just the
       last) renders identically. Do not revert to absolute+top/left
       centering without re-testing an actual multi-sticker print/PDF, not
       just a single-sticker or on-screen preview — both of those looked
       fine even with the old, broken CSS. */
    .sticker-page {
      width: 100mm; height: 120mm; overflow: hidden;
      margin: 0; page-break-after: always; break-after: page;
      page-break-inside: avoid; break-inside: avoid;
      display: flex; align-items: center; justify-content: center;
    }
    .sticker-page:last-child { page-break-after: auto; break-after: auto; }
    .sticker {
      flex: none;
      transform: rotate(${getStickerRotationDeg()}deg);
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
  /* A thermal print is monochrome, so this can't lean on color to stand
     out the way a food-safety warning normally would — weight, a border,
     and the ⚠ glyph carry it instead. Only rendered when the product
     actually has an allergen on file (see buildStickerItem callers), so a
     non-allergen item's label isn't padded with a redundant "no allergen"
     line. */
  .bottom-allergen-warning { font-size: 13px; font-weight: 700; line-height: 1.15; text-align: center; margin-top: 0.5mm; padding: 0.5mm 1mm; border: 1px solid #000; overflow-wrap: break-word; word-break: break-word; }
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
  depositDate, customerName, productName, productCode, quantityLabel, locationCode, trackingCode, allergenLabel,
}) {
  const html = stickerDocumentHtml(renderStickerPageHtml({
    depositDate, customerName, productName, productCode, quantityLabel, locationCode, trackingCode, allergenLabel,
  }));
  openAndPrintHtml(html, 1);
}

// items: [{ depositDate, productName, quantityLabel, locationCode, trackingCode }]
// Prints every item as its own page in ONE print job/popup. Sorted by
// trackingCode (e.g. "FR260815038", "FF260901002") before printing so
// stickers group by their temperature-type prefix (FF, FR, FZ, CH, AM —
// see tgd_generate_deposit_line_tracking_code) instead of interleaving in
// whatever order the source table's rows happened to be in — otherwise a
// deposit with rows added in mixed temperature order prints an alternating
// stack that's tedious to sort/stack by hand afterward.
export function printStickers(items = []) {
  if (!items.length) return;
  const sorted = [...items].sort((a, b) =>
    String(a.trackingCode ?? '').localeCompare(String(b.trackingCode ?? '')),
  );
  const html = stickerDocumentHtml(sorted.map((item) => renderStickerPageHtml(item)).join('\n'), sorted.length);
  openAndPrintHtml(html, sorted.length);
}

// ---------------------------------------------------------------------------
// Allergen state shared by both sticker formats.
//
// YES: the product has allergen text on file. NO: the product is in the
// catalog with no allergen. UNKNOWN: no catalog match, so we cannot say.
// The thermal label only prints a warning for YES (pass allergenLabel =
// allergenThermalLabel(...)); the A5 label always states one of the three.
const NO_ALLERGEN_PATTERN = /^(ไม่มี.*|no|none|n\/a|-|–)$/i;

export function resolveAllergen(catalogMatch) {
  if (!catalogMatch) return { status: 'UNKNOWN', text: '' };
  const text = String(catalogMatch.allergen ?? '').trim();
  if (!text || NO_ALLERGEN_PATTERN.test(text)) return { status: 'NO', text: '' };
  return { status: 'YES', text };
}

export function allergenThermalLabel(allergen) {
  return allergen?.status === 'YES' ? allergen.text : '';
}

// ---------------------------------------------------------------------------
// A5 pallet sticker (210 x 148 mm landscape, office printer), printed as two copies on one A4 sheet.
//
// One sheet per pallet: the tracking code as the largest element, then the
// pallet number n/N, that pallet's location and quantity, lot / MFG / EXP,
// product code + name, the allergen state and a QR of the tracking code.

function toQty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatQty(value, digits = 0) {
  const n = toQty(value);
  if (n == null) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// baseItem: the line-level sticker fields (tracking code, product, lot...,
//   lotBoxes / lotWeight = the whole line's quantity).
// allocations: [{ palletNo, locationCode, boxes, weight }] -- real pallets.
// manual: { count, boxesPerPallet } -- used only when there are no
//   allocations yet; boxes are split boxesPerPallet at a time and the last
//   sheet takes the remainder, weight follows the line's average per box.
export function buildPalletStickerItems(baseItem, allocations = [], manual = null) {
  const real = [...(allocations ?? [])].sort((a, b) => Number(a.palletNo) - Number(b.palletNo));
  if (real.length > 0) {
    return real.map((a, i) => ({
      ...baseItem,
      palletIndex: i + 1,
      palletTotal: real.length,
      locationCode: a.locationCode ? buildPalletCode(a.locationCode, a.palletNo) : '-',
      locationName: a.locationDisplayName ?? null,
      boxes: toQty(a.boxes),
      weight: toQty(a.weight),
    }));
  }

  const count = Math.max(1, Math.floor(Number(manual?.count) || 1));
  // manual.totalBoxes: split only this many (e.g. a lot's unplaced boxes);
  // the sheet still shows the whole lot under "ทั้ง lot".
  const lotBoxes = toQty(manual?.totalBoxes ?? baseItem.lotBoxes) ?? 0;
  const lotWeight = toQty(baseItem.lotWeight);
  const lotBoxesForAverage = toQty(baseItem.lotBoxes) ?? lotBoxes;
  const perPallet = Math.max(1, Math.floor(Number(manual?.boxesPerPallet) || Math.ceil(lotBoxes / count) || 1));
  const weightPerBox = lotWeight != null && lotBoxesForAverage > 0 ? lotWeight / lotBoxesForAverage : null;
  let left = lotBoxes;
  return Array.from({ length: count }, (_, i) => {
    const boxes = i < count - 1 ? Math.min(perPallet, Math.max(0, left)) : Math.max(0, left);
    left -= boxes;
    return {
      ...baseItem,
      palletIndex: i + 1,
      palletTotal: count,
      locationCode: '-',
      boxes,
      weight: weightPerBox != null ? Math.round(boxes * weightPerBox * 100) / 100 : null,
    };
  });
}

// Default pallet count for an unplaced lot: boxes / the product's usual
// boxes per pallet, rounded up.
export function suggestPalletCount(lotBoxes, boxesPerPallet) {
  const boxes = Number(lotBoxes) || 0;
  const per = Number(boxesPerPallet) || 0;
  if (boxes <= 0 || per <= 0) return 1;
  return Math.max(1, Math.ceil(boxes / per));
}

const WARN_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18v.5"/></svg>';

function renderAllergenBadge(status, text) {
  if (status === 'YES') return `<span class="a5-alg yes">${WARN_ICON_SVG}<span>มีสารก่อภูมิแพ้: ${withSoftBreaks(text)}</span></span>`;
  if (status === 'NO') return '<span class="a5-alg">ไม่มีสารก่อภูมิแพ้</span>';
  return '<span class="a5-alg">ไม่ระบุสารก่อภูมิแพ้</span>';
}

function renderA5StickerPageHtml(item) {
  const qrSvg = renderToStaticMarkup(<QRCode value={item.trackingCode || ''} size={128} style={{ width: '100%', height: 'auto' }} />);
  const unit = item.unitLabel || 'กล่อง';
  const weight = toQty(item.weight);
  const lotWeight = toQty(item.lotWeight);
  return `<div class="a5-page">
  <div class="a5">
    <div class="a5-top">
      <div class="a5-cust">${item.customerName || '-'}</div>
      <div class="a5-date">วันที่รับเข้า<b>${formatStickerDate(item.depositDate)}</b></div>
    </div>
    <div class="a5-mid"><div class="a5-fr fit">${item.trackingCode || '-'}</div></div>
    <div class="a5-facts">
      <div class="a5-pal"><span class="a5-lbl">พาเลท</span><div class="a5-v">${item.palletIndex ?? 1} / ${item.palletTotal ?? 1}</div></div>
      <div class="a5-loc"><span class="a5-lbl">Location${item.locationName ? ` · ${item.locationName}` : ''}</span><div class="a5-v fit">${item.locationCode || '-'}</div></div>
      <div class="a5-qty"><span class="a5-lbl">จำนวน (พาเลทนี้)</span><div class="a5-qtyv">
        <div class="a5-v">${formatQty(item.boxes)} ${unit}${weight != null ? `<span>/ ${formatQty(weight, 2)} กก.</span>` : ''}</div>
        <small>ทั้ง lot ${formatQty(item.lotBoxes)} ${unit}${lotWeight != null ? ` / ${formatQty(lotWeight, 2)} กก.` : ''}</small>
      </div></div>
    </div>
    <div class="a5-lower">
      <div>
        <div class="a5-bot">
          <div>Lot ลูกค้า<br><b>${withSoftBreaks(item.lotNo) || '-'}</b></div>
          <div>วันผลิต (MFG)<br><b>${formatStickerDate(item.mfgDate)}</b></div>
          <div>วันหมดอายุ (EXP)<br><b class="a5-exp">${formatStickerDate(item.expDate)}</b></div>
        </div>
        <div class="a5-prod">
          ${item.productCode ? `<span class="a5-code">${withSoftBreaks(item.productCode)}</span>` : ''}
          <span class="a5-name">${item.productName || '-'}</span>
          ${renderAllergenBadge(item.allergenStatus, item.allergenText)}
        </div>
      </div>
      <div class="a5-qr">${qrSvg}</div>
    </div>
  </div>
</div>`;
}

// Shrinks every .fit element until it fits its box, after fonts load. Runs
// inside the print popup before print() fires (openAndPrintHtml waits at
// least 500 ms), so an unusually long code never runs off the sheet.
const FIT_TEXT_SCRIPT = `<script>
(function () {
  function fit() {
    document.querySelectorAll('.fit').forEach(function (el) {
      var size = parseFloat(getComputedStyle(el).fontSize);
      var box = el.parentElement;
      var guard = 0;
      while ((el.scrollWidth > box.clientWidth - 2 || el.offsetHeight > box.clientHeight - 2) && size > 8 && guard < 120) {
        size -= 1; el.style.fontSize = size + 'px'; guard += 1;
      }
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else window.addEventListener('load', fit);
})();
</script>`;

function a5DocumentHtml(pagesHtml) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sticker A5</title>
<style>
  @font-face { font-family: 'TGD Code'; font-weight: 700; src: url(${OSWALD_BOLD_SUBSET_WOFF2_DATA_URI}) format('woff2'); }
  /* Each pallet prints on one A4 portrait sheet: two copies of its A5 sticker, top and bottom, with a
     cut line between. The 6mm padding keeps each sticker clear of the
     printer's unprintable edge. */
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Thai-capable fonts first -- same reasoning as the thermal sticker above. */
  body { font-family: 'Leelawadee UI', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; }
  .a4-sheet { position: relative; width: 210mm; height: 296mm; margin: 0 auto; overflow: hidden; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
  .a4-sheet:last-child { page-break-after: auto; break-after: auto; }
  .a4-sheet.two::after { content: ''; position: absolute; left: 0; right: 0; top: 148mm; border-top: 0.3mm dashed #888; }
  .a5-page { width: 210mm; height: 148mm; padding: 6mm; }
  .a5 { width: 100%; height: 100%; border: 0.7mm solid #000; border-radius: 3mm; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr auto auto; overflow: hidden; }
  .a5-top { display: flex; justify-content: space-between; align-items: center; gap: 4mm; padding: 2.5mm 5mm 2mm; border-bottom: 0.7mm solid #000; }
  .a5-cust { font-size: 5mm; font-weight: 700; line-height: 1.25; overflow-wrap: break-word; word-break: break-word; min-width: 0; }
  .a5-date { font-size: 3.4mm; text-align: right; line-height: 1.3; white-space: nowrap; }
  .a5-date b { display: block; font-size: 4.8mm; }
  .a5-mid { display: grid; place-items: center; padding: 1mm 4mm; border-bottom: 0.7mm solid #000; min-width: 0; overflow: hidden; }
  .a5-fr { font-family: 'TGD Code', 'Arial Narrow', 'Roboto Condensed', sans-serif; font-weight: 700; font-size: 32mm; line-height: 1; letter-spacing: 0.01em; white-space: nowrap; }
  .a5-facts { display: grid; grid-template-columns: auto auto minmax(0, 1fr); border-bottom: 0.7mm solid #000; }
  .a5-facts > div { display: grid; grid-template-rows: auto 1fr; padding: 2mm 4mm; border-right: 0.6mm solid #000; min-width: 0; }
  .a5-facts > div:last-child { border-right: 0; }
  .a5-lbl { font-size: 3.4mm; font-weight: 700; line-height: 1.3; }
  .a5-v { font-weight: 700; line-height: 1.1; align-self: center; white-space: nowrap; }
  .a5-pal { background: #000; color: #fff; text-align: center; min-width: 43mm; }
  .a5-pal .a5-v { font-family: 'TGD Code', 'Arial Narrow', sans-serif; font-size: 16mm; }
  .a5-loc { max-width: 92mm; }
  .a5-loc .a5-v { font-family: 'TGD Code', 'Arial Narrow', sans-serif; font-size: 14mm; letter-spacing: 0.01em; }
  .a5-qtyv { align-self: center; }
  .a5-qty .a5-v { font-size: 11mm; }
  .a5-qty .a5-v span { display: block; font-size: 6.5mm; }
  .a5-qty small { display: block; font-size: 3.6mm; font-weight: 700; margin-top: 0.8mm; }
  .a5-lower { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
  .a5-bot { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4mm; padding: 2mm 5mm; font-size: 3.8mm; line-height: 1.35; border-bottom: 0.7mm solid #000; }
  .a5-bot b { font-size: 5mm; }
  .a5-exp { background: #000; color: #fff; padding: 0 1.5mm; border-radius: 0.8mm; }
  .a5-prod { display: flex; align-items: center; flex-wrap: wrap; gap: 2mm 4mm; padding: 2mm 5mm; }
  .a5-code { font-size: 5.2mm; font-weight: 700; white-space: nowrap; border: 0.6mm solid #000; border-radius: 1mm; padding: 0 2mm; }
  .a5-name { font-size: 5.2mm; font-weight: 700; line-height: 1.3; overflow-wrap: break-word; word-break: break-word; min-width: 0; }
  .a5-alg { display: inline-flex; align-items: center; gap: 1.5mm; font-size: 4.6mm; font-weight: 700; white-space: nowrap; border: 0.6mm solid #000; border-radius: 1mm; padding: 0.4mm 2.4mm; }
  .a5-alg.yes { background: #000; color: #fff; }
  .a5-alg svg { width: 5.4mm; height: 5.4mm; flex: none; }
  .a5-qr { border-left: 0.7mm solid #000; padding: 2.5mm 3mm; display: grid; place-items: center; }
  .a5-qr svg { width: 28mm; height: 28mm; display: block; }
  @media screen { body { background: #eee; padding: 6mm 0; } .a4-sheet { background: #fff; margin-bottom: 6mm; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }
</style>
</head>
<body>
${pagesHtml}
${FIT_TEXT_SCRIPT}
</body>
</html>`;
}

export function buildA5StickerDocumentHtml(items = []) {
  // One A4 sheet per pallet, holding two identical copies of its sticker.
  return a5DocumentHtml(items.map((item) => {
    const sticker = renderA5StickerPageHtml(item);
    return `<div class="a4-sheet two">\n${sticker}\n${sticker}\n</div>`;
  }).join('\n'));
}

// items: output of buildPalletStickerItems (one entry per pallet sheet).
// Kept in tracking-code then pallet order so a multi-line job comes out
// grouped by lot, 1/N..N/N.
export function printA5Stickers(items = []) {
  if (!items.length) return;
  const sorted = [...items].sort((a, b) =>
    String(a.trackingCode ?? '').localeCompare(String(b.trackingCode ?? '')) || (a.palletIndex ?? 0) - (b.palletIndex ?? 0),
  );
  openAndPrintHtml(buildA5StickerDocumentHtml(sorted), sorted.length);
}

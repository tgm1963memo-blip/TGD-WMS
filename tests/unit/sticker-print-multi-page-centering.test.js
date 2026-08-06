import { describe, expect, it, vi } from 'vitest';
import { printStickers } from '../../src/utils/stickerPrint.jsx';

// Regression: printing 2+ stickers in one job used position:absolute +
// top/left:50% + translate(-50%,-50%) to center the rotated .sticker
// inside its .sticker-page. Reproduced with a real multi-page Chromium
// print/PDF render (not just the on-screen preview, which looked fine):
// every page EXCEPT the last had its border cut off, its QR code
// missing, and overlapping/garbled text — Chromium's print pagination
// mis-resolves a percentage top/left against the wrong containing block
// once page-break-after:always fragments the flow. Fixed by centering
// .sticker via flexbox on .sticker-page instead, which has no
// percentage-offset step to get wrong. See src/utils/stickerPrint.jsx.

const item = {
  depositDate: '2026-08-06', customerName: 'OVO Foodtech Co.,Ltd.',
  productName: 'สินค้าทดสอบ', productCode: 'TEST-001',
  quantityLabel: '10 / 100.00', locationCode: 'A-01', trackingCode: 'FR260806001',
};

function mockPopupCapturingWrite() {
  let written = '';
  const win = {
    document: { write: (html) => { written = html; }, close: vi.fn() },
    onload: null,
    print: vi.fn(),
  };
  const openSpy = vi.spyOn(window, 'open').mockReturnValue(win);
  return { openSpy, getWritten: () => written };
}

describe('sticker print multi-page centering avoids position:absolute + percentage top/left', () => {
  it('centers .sticker on .sticker-page via flexbox, not absolute top/left percentages', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printStickers([item, { ...item, trackingCode: 'FR260806002' }, { ...item, trackingCode: 'FR260806003' }]);
    const html = getWritten();

    expect(html).toContain('display: flex; align-items: center; justify-content: center;');
    // The old, broken technique must not come back.
    expect(html).not.toMatch(/\.sticker\s*\{[^}]*position:\s*absolute/);
    expect(html).not.toMatch(/top:\s*50%;\s*left:\s*50%/);
    openSpy.mockRestore();
  });
});

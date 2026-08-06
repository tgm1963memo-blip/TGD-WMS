import { describe, expect, it, vi } from 'vitest';
import { printSticker, printStickers } from '../../src/utils/stickerPrint.jsx';

// Allergen was dropped from the sticker in an earlier redesign, then asked
// back in specifically as a warning line in the product-name box — a
// food-safety detail a handler needs to see, not a display frill. Only
// shown when the product actually has one on file, so a non-allergen
// item's label isn't padded with a redundant "no allergen" line.

const baseItem = {
  depositDate: '2026-08-06', customerName: 'OVO Foodtech Co.,Ltd.',
  productName: 'ไส้กรอกเบคอนรมควัน', productCode: 'CH2608',
  quantityLabel: '614 กล่อง / 6,140.00 กก.', locationCode: '-', trackingCode: 'FR260608027',
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

describe('sticker allergen warning line', () => {
  it('printSticker shows the allergen text in the product-name box when present', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    // Short enough (<=8 graphemes) to stay a single unbroken run through
    // insertSoftBreaks — a longer string gets zero-width-space chunking,
    // which is exercised separately and isn't what this test is about.
    printSticker({ ...baseItem, allergenLabel: 'กลูเตน' });
    expect(getWritten()).toContain('<div class="bottom-allergen-warning">');
    expect(getWritten()).toContain('กลูเตน');
    openSpy.mockRestore();
  });

  it('printSticker omits the warning line entirely when there is no allergen', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printSticker({ ...baseItem, allergenLabel: '' });
    expect(getWritten()).not.toContain('<div class="bottom-allergen-warning">');
    openSpy.mockRestore();
  });

  it('printStickers (bulk path) also renders the warning line per item', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printStickers([
      { ...baseItem, trackingCode: 'FR260608027', allergenLabel: 'ถั่วเหลือง' },
      { ...baseItem, trackingCode: 'FR260608028', allergenLabel: '' },
    ]);
    const html = getWritten();
    expect(html.match(/<div class="bottom-allergen-warning">/g)).toHaveLength(1);
    expect(html).toContain('ถั่ว');
    openSpy.mockRestore();
  });
});

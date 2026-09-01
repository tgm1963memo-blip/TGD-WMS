import { describe, expect, it, vi } from 'vitest';
import { printStickers } from '../../src/utils/stickerPrint.jsx';

// Real complaint: printing several selected deposit lines at once printed
// stickers in whatever order the source table's rows happened to be in —
// if FR (FROZEN) and FF (FREEZE_FROZEN) lines were interleaved in the
// table, the printed stack alternated between them too, making it tedious
// to sort/stack physically afterward. printStickers now sorts by
// trackingCode (its temperature-type prefix, e.g. FF/FR/FZ/CH/AM — see
// tgd_generate_deposit_line_tracking_code) so same-prefix stickers group
// together, in whatever order they happen to be selected/passed in.

const baseItem = {
  depositDate: '2026-09-01', customerName: 'TGM',
  productName: 'สินค้าทดสอบ', productCode: 'TEST-001',
  quantityLabel: '10 / 100.00', locationCode: 'A-01',
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

describe('printStickers groups by trackingCode prefix instead of printing in table row order', () => {
  // renderStickerPageHtml splits trackingCode roughly in half across two
  // text lines (splitTrackingCode), so a full code never appears as one
  // contiguous substring in the rendered HTML — search for each item's
  // first half instead, using codes whose first halves are distinct.
  it('reorders an interleaved FR/FF/FR selection so both FF group before FR (alphabetical: FF < FR)', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printStickers([
      { ...baseItem, trackingCode: 'FRCCC0001' },
      { ...baseItem, trackingCode: 'FFAAA0001' },
      { ...baseItem, trackingCode: 'FRDDD0002' },
      { ...baseItem, trackingCode: 'FFBBB0002' },
    ]);
    const html = getWritten();

    const ff1 = html.indexOf('FFAAA');
    const ff2 = html.indexOf('FFBBB');
    const fr1 = html.indexOf('FRCCC');
    const fr2 = html.indexOf('FRDDD');

    expect([ff1, ff2, fr1, fr2].every((i) => i !== -1)).toBe(true);
    // Both FF stickers must appear (as whole printed pages) before both FR ones.
    expect(ff2).toBeLessThan(fr1);
    expect(ff1).toBeLessThan(fr1);
    openSpy.mockRestore();
  });

  it('does not mutate the caller-supplied items array', () => {
    const { openSpy } = mockPopupCapturingWrite();
    const items = [
      { ...baseItem, trackingCode: 'FR260901002' },
      { ...baseItem, trackingCode: 'FF260901001' },
    ];
    const originalOrder = items.map((i) => i.trackingCode);
    printStickers(items);
    expect(items.map((i) => i.trackingCode)).toEqual(originalOrder);
    openSpy.mockRestore();
  });

  it('does not throw when an item is missing trackingCode', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printStickers([
      { ...baseItem, trackingCode: 'FR260901001' },
      { ...baseItem },
    ]);
    expect(getWritten()).toBeTruthy();
    openSpy.mockRestore();
  });
});

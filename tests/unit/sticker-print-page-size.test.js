import { describe, expect, it, vi, beforeEach } from 'vitest';
import { printSticker, printStickers, setStickerPageSizeMode } from '../../src/utils/stickerPrint.jsx';

const item = {
  depositDate: '2026-07-23',
  customerName: 'บริษัท ทดสอบ จำกัด',
  productName: 'สินค้าทดสอบ',
  productCode: 'TEST-001',
  quantityLabel: '10 / 100.00',
  locationCode: 'A-01',
  trackingCode: 'FR260723001',
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

describe('sticker print @page sizing (bleeding/overlap fix for multi-sticker jobs)', () => {
  beforeEach(() => {
    setStickerPageSizeMode('auto');
  });

  it('does not force an explicit @page size for a single sticker in auto mode (unchanged, already worked)', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printSticker(item);
    expect(openSpy).toHaveBeenCalled();
    expect(getWritten()).toMatch(/@page\s*\{\s*margin:\s*0;\s*\}/);
    openSpy.mockRestore();
  });

  it('forces the true 100x120mm @page size for a multi-sticker job even in auto mode', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printStickers([item, { ...item, trackingCode: 'FR260723002' }]);
    expect(openSpy).toHaveBeenCalled();
    expect(getWritten()).toMatch(/@page\s*\{\s*margin:\s*0;\s*size:\s*100mm\s*120mm;\s*\}/);
    openSpy.mockRestore();
  });

  it('still forces the size in fixed mode regardless of item count', () => {
    setStickerPageSizeMode('fixed');
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printSticker(item);
    expect(getWritten()).toMatch(/size:\s*100mm\s*120mm;/);
    openSpy.mockRestore();
  });

  it('emits both legacy and modern page-break properties, with a hard break-after between stickers', () => {
    const { openSpy, getWritten } = mockPopupCapturingWrite();
    printStickers([item, { ...item, trackingCode: 'FR260723002' }]);
    const html = getWritten();
    expect(html).toContain('page-break-after: always');
    expect(html).toContain('break-after: page');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('break-inside: avoid');
    openSpy.mockRestore();
  });
});

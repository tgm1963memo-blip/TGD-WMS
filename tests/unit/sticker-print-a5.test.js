import { describe, expect, it, vi } from 'vitest';
import {
  resolveAllergen,
  allergenThermalLabel,
  buildPalletStickerItems,
  suggestPalletCount,
  buildA5StickerDocumentHtml,
  printA5Stickers,
} from '../../src/utils/stickerPrint.jsx';

// A5 pallet sticker: one sheet per pallet with "n / N", the tracking code
// as the largest element, and the allergen state always printed.

const base = {
  depositDate: '2026-11-24', customerName: 'ไทย-เยอรมัน', productName: 'เศษมันหมู', productCode: 'SPF122',
  trackingCode: 'FR261124002', lotNo: 'L2611-A', mfgDate: '2026-11-20', expDate: '2027-11-24',
  lotBoxes: 75, lotWeight: 750, allergenStatus: 'YES', allergenText: 'ถั่วเหลือง',
};

describe('resolveAllergen', () => {
  it('distinguishes has / none / unknown', () => {
    expect(resolveAllergen({ allergen: 'ถั่วเหลือง' })).toEqual({ status: 'YES', text: 'ถั่วเหลือง' });
    expect(resolveAllergen({ allergen: '' })).toEqual({ status: 'NO', text: '' });
    expect(resolveAllergen({ allergen: 'ไม่มี' })).toEqual({ status: 'NO', text: '' });
    expect(resolveAllergen(null)).toEqual({ status: 'UNKNOWN', text: '' });
  });

  it('only gives the thermal label text when there is an allergen', () => {
    expect(allergenThermalLabel({ status: 'YES', text: 'นม' })).toBe('นม');
    expect(allergenThermalLabel({ status: 'NO', text: '' })).toBe('');
    expect(allergenThermalLabel({ status: 'UNKNOWN', text: '' })).toBe('');
  });
});

describe('buildPalletStickerItems', () => {
  it('prints one sheet per real pallet in pallet order', () => {
    const items = buildPalletStickerItems(base, [
      { palletNo: 5, locationCode: '41-L-30', boxes: 15, weight: 150 },
      { palletNo: 2, locationCode: '41-A-28', boxes: 60, weight: 600 },
    ]);
    expect(items.map((i) => [i.palletIndex, i.palletTotal, i.locationCode, i.boxes])).toEqual([
      [1, 2, '41-A-28-02', 60],
      [2, 2, '41-L-30-05', 15],
    ]);
  });

  it('splits an unplaced lot by the entered pallet count, last sheet takes the rest', () => {
    const items = buildPalletStickerItems({ ...base, lotBoxes: 15, lotWeight: 150 }, [], { count: 2, boxesPerPallet: 8 });
    expect(items.map((i) => [i.palletIndex, i.palletTotal, i.boxes, i.weight, i.locationCode])).toEqual([
      [1, 2, 8, 80, '-'],
      [2, 2, 7, 70, '-'],
    ]);
  });

  it('suggests a pallet count from the product boxes per pallet', () => {
    expect(suggestPalletCount(75, 16)).toBe(5);
    expect(suggestPalletCount(75, null)).toBe(1);
  });
});

describe('A5 sticker document', () => {
  it('is an A5 landscape page with the pallet number, allergen badge and QR', () => {
    const html = buildA5StickerDocumentHtml(buildPalletStickerItems(base, [], { count: 5, boxesPerPallet: 15 }));
    expect(html).toContain('size: A5 landscape');
    expect(html.match(/class="a5-page"/g)).toHaveLength(5);
    expect(html).toContain('3 / 5');
    expect(html).toContain('มีสารก่อภูมิแพ้: ');
    expect(html).toContain('<svg');
    expect(html).toContain('font/woff2;base64');
  });

  it('states when there is no allergen or it is unknown', () => {
    expect(buildA5StickerDocumentHtml([{ ...base, allergenStatus: 'NO' }])).toContain('ไม่มีสารก่อภูมิแพ้');
    expect(buildA5StickerDocumentHtml([{ ...base, allergenStatus: 'UNKNOWN' }])).toContain('ไม่ระบุสารก่อภูมิแพ้');
  });

  it('printA5Stickers writes every sheet into one popup', () => {
    let written = '';
    const win = { document: { write: (h) => { written = h; }, close: vi.fn() }, onload: null, print: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win);
    printA5Stickers(buildPalletStickerItems(base, [], { count: 3, boxesPerPallet: 25 }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(written.match(/class="a5-page"/g)).toHaveLength(3);
    openSpy.mockRestore();
  });
});

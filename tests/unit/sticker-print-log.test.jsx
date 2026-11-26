import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Sticker print history: every print writes one row per sheet, and deposit
// lines show "พิมพ์แล้ว N แผ่น".

const insert = vi.fn(async () => ({ error: null }));
vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: vi.fn(() => ({ insert })) },
}));

const {
  buildStickerPrintLogRows, logStickerPrints, summarizeStickerPrintLogs, STICKER_PRINTED_EVENT,
} = await import('../../src/services/stickerPrintLogService.js');
const { StickerPrintBadge } = await import('../../src/components/sticker/StickerPrintHistory.jsx');
const { printA5Stickers, printSticker } = await import('../../src/utils/stickerPrint.jsx');

describe('sticker print log rows', () => {
  it('keeps pallet and location, and drops "-" placeholders', () => {
    expect(buildStickerPrintLogRows('A5', [
      { trackingCode: 'FR1', palletIndex: 2, palletTotal: 3, locationCode: '41-L-30-04', boxes: 15 },
      { trackingCode: 'FR1', palletIndex: 3, palletTotal: 3, locationCode: '-', boxes: '' },
    ], '/dashboard')).toEqual([
      { sticker_format: 'A5', tracking_code: 'FR1', pallet_index: 2, pallet_total: 3, location_code: '41-L-30-04', boxes: 15, source_path: '/dashboard' },
      { sticker_format: 'A5', tracking_code: 'FR1', pallet_index: 3, pallet_total: 3, location_code: null, boxes: null, source_path: '/dashboard' },
    ]);
  });

  it('summarizes count and the latest print per tracking code', () => {
    const map = summarizeStickerPrintLogs([
      { tracking_code: 'FR1', printed_at: '2026-11-26T01:00:00Z', printed_by_email: 'a@x', sticker_format: 'THERMAL' },
      { tracking_code: 'FR1', printed_at: '2026-11-26T03:00:00Z', printed_by_email: 'b@x', sticker_format: 'A5' },
      { tracking_code: 'FR2', printed_at: '2026-11-25T03:00:00Z', printed_by_email: null, sticker_format: 'A5' },
    ]);
    expect(map.get('FR1')).toEqual({ count: 2, lastAt: '2026-11-26T03:00:00Z', lastBy: 'b@x', lastFormat: 'A5' });
    expect(map.get('FR2').count).toBe(1);
  });

  it('renders the badge only when there is history', () => {
    const { rerender } = render(<StickerPrintBadge entry={undefined} />);
    expect(screen.queryByTestId('sticker-print-badge')).toBeNull();
    rerender(<StickerPrintBadge entry={{ count: 4, lastAt: '2026-11-26T03:05:00', lastBy: 'b@x', lastFormat: 'A5' }} />);
    expect(screen.getByTestId('sticker-print-badge')).toHaveTextContent('พิมพ์แล้ว 4 แผ่น · 26/11/2026 03:05');
    expect(screen.getByTestId('sticker-print-badge').title).toContain('โดย b@x');
  });
});

describe('printing writes the log', () => {
  beforeEach(() => { insert.mockClear(); });

  function stubPopup(opened) {
    const win = opened ? { document: { write: vi.fn(), close: vi.fn() }, print: vi.fn() } : null;
    vi.spyOn(window, 'open').mockReturnValue(win);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  }

  it('logs one A5 row per pallet sheet and announces it', async () => {
    stubPopup(true);
    const heard = vi.fn();
    window.addEventListener(STICKER_PRINTED_EVENT, heard);
    printA5Stickers([
      { trackingCode: 'FR1', palletIndex: 1, palletTotal: 2, locationCode: '-', boxes: 20 },
      { trackingCode: 'FR1', palletIndex: 2, palletTotal: 2, locationCode: '-', boxes: 20 },
    ]);
    await vi.waitFor(() => expect(heard).toHaveBeenCalled());
    expect(insert.mock.calls[0][0]).toHaveLength(2);
    expect(insert.mock.calls[0][0][0]).toMatchObject({ sticker_format: 'A5', tracking_code: 'FR1', pallet_index: 1 });
    expect(heard.mock.calls[0][0].detail.trackingCodes).toEqual(['FR1']);
    window.removeEventListener(STICKER_PRINTED_EVENT, heard);
  });

  it('logs a thermal print, and nothing when the popup is blocked', async () => {
    stubPopup(true);
    printSticker({ trackingCode: 'FR9', locationCode: '41-L-01-01' });
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect(insert.mock.calls[0][0][0]).toMatchObject({ sticker_format: 'THERMAL', tracking_code: 'FR9', location_code: '41-L-01-01' });

    insert.mockClear();
    stubPopup(false);
    printSticker({ trackingCode: 'FR9' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('never throws when the insert fails', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'rls' } });
    await expect(logStickerPrints('A5', [{ trackingCode: 'FR1' }])).resolves.toEqual({ error: { message: 'rls' } });
  });
});

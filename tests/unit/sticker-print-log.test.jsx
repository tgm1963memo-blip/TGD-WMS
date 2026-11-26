import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Sticker print history: every print writes one row per sheet, deposit
// lines show "พิมพ์แล้ว N แผ่น", printing the same sticker again asks first,
// and the history page lists and flags reprints.

const db = { inserted: [], insertError: null, selectRows: [], calls: [] };
const insert = vi.fn((rows) => ({
  select: async () => {
    if (db.insertError) return { data: null, error: db.insertError };
    const saved = rows.map((r, i) => ({ ...r, id: `n${db.inserted.length + i}`, printed_at: new Date().toISOString(), printed_by_email: 'me@x' }));
    db.inserted.push(...saved);
    return { data: saved, error: null };
  },
}));
function selectChain() {
  const chain = {};
  for (const m of ['in', 'order', 'limit', 'gte', 'lt', 'ilike', 'eq']) {
    chain[m] = (...args) => { db.calls.push([m, ...args]); return chain; };
  }
  chain.then = (resolve) => resolve({ data: db.selectRows, error: null });
  return chain;
}
vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { from: vi.fn(() => ({ insert, select: () => selectChain() })) },
}));

const svc = await import('../../src/services/stickerPrintLogService.js');
const { StickerPrintBadge } = await import('../../src/components/sticker/StickerPrintHistory.jsx');
const { printA5Stickers, printSticker, buildReprintMessage } = await import('../../src/utils/stickerPrint.jsx');
const { StickerPrintHistoryPage, summarizePrintRows } = await import('../../src/features/inventory/StickerPrintHistoryPage.jsx');

function stubPopup(opened) {
  const win = opened ? { document: { write: vi.fn(), close: vi.fn() }, print: vi.fn() } : null;
  vi.spyOn(window, 'open').mockReturnValue(win);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
}

beforeEach(() => {
  insert.mockClear();
  db.inserted = []; db.insertError = null; db.selectRows = []; db.calls = [];
  svc.resetStickerPrintCache();
  vi.restoreAllMocks();
});

describe('sticker print log rows', () => {
  it('keeps pallet and location, and drops "-" placeholders', () => {
    expect(svc.buildStickerPrintLogRows('A5', [
      { trackingCode: 'FR1', palletIndex: 2, palletTotal: 3, locationCode: '41-L-30-04', boxes: 15 },
      { trackingCode: 'FR1', palletIndex: 3, palletTotal: 3, locationCode: '-', boxes: '' },
    ], '/dashboard')).toEqual([
      { sticker_format: 'A5', tracking_code: 'FR1', pallet_index: 2, pallet_total: 3, location_code: '41-L-30-04', boxes: 15, source_path: '/dashboard' },
      { sticker_format: 'A5', tracking_code: 'FR1', pallet_index: 3, pallet_total: 3, location_code: null, boxes: null, source_path: '/dashboard' },
    ]);
  });

  it('summarizes count and the latest print per tracking code', () => {
    const map = svc.summarizeStickerPrintLogs([
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
  it('logs one A5 row per pallet sheet and announces it', async () => {
    stubPopup(true);
    const heard = vi.fn();
    window.addEventListener(svc.STICKER_PRINTED_EVENT, heard);
    printA5Stickers([
      { trackingCode: 'FR1', palletIndex: 1, palletTotal: 2, locationCode: '-', boxes: 20 },
      { trackingCode: 'FR1', palletIndex: 2, palletTotal: 2, locationCode: '-', boxes: 20 },
    ]);
    await vi.waitFor(() => expect(heard).toHaveBeenCalled());
    expect(insert.mock.calls[0][0]).toHaveLength(2);
    expect(insert.mock.calls[0][0][0]).toMatchObject({ sticker_format: 'A5', tracking_code: 'FR1', pallet_index: 1 });
    expect(heard.mock.calls[0][0].detail.trackingCodes).toEqual(['FR1']);
    window.removeEventListener(svc.STICKER_PRINTED_EVENT, heard);
  });

  it('logs a thermal print, and nothing when the popup is blocked', async () => {
    stubPopup(true);
    printSticker({ trackingCode: 'FR9', locationCode: '41-L-01-01' });
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect(insert.mock.calls[0][0][0]).toMatchObject({ sticker_format: 'THERMAL', tracking_code: 'FR9', location_code: '41-L-01-01' });

    insert.mockClear();
    stubPopup(false);
    printSticker({ trackingCode: 'FR8' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('never throws when the insert fails', async () => {
    db.insertError = { message: 'rls' };
    await expect(svc.logStickerPrints('A5', [{ trackingCode: 'FR1' }])).resolves.toEqual({ error: { message: 'rls' } });
  });
});

describe('reprint warning', () => {
  const sheet = (i) => ({ trackingCode: 'FR1', palletIndex: i, palletTotal: 3, locationCode: '-', boxes: 10 });

  it('asks before printing the same A5 pallet again, and stops if staff cancel', async () => {
    stubPopup(true);
    printA5Stickers([sheet(1), sheet(2)]);
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    printA5Stickers([sheet(2), sheet(3)]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain('FR1 พาเลท 2/3 — พิมพ์แล้ว 1 ครั้ง');
    expect(confirmSpy.mock.calls[0][0]).not.toContain('พาเลท 3/3');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('prints anyway when staff accept, and does not ask for a new pallet', async () => {
    stubPopup(true);
    printA5Stickers([sheet(1)]);
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    printA5Stickers([sheet(1)]);
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(2));
    printA5Stickers([sheet(3)]);
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(3));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('uses history loaded from the server (thermal, same location)', async () => {
    db.selectRows = [{ tracking_code: 'FR7', sticker_format: 'THERMAL', location_code: '41-L-02-01', printed_at: '2026-11-25T02:00:00Z', printed_by_email: 'a@x' }];
    await svc.loadStickerPrintRows(['FR7']);
    stubPopup(true);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    printSticker({ trackingCode: 'FR7', locationCode: '41-L-02-02' });
    expect(confirmSpy).not.toHaveBeenCalled();
    printSticker({ trackingCode: 'FR7', locationCode: '41-L-02-01' });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain('FR7 (41-L-02-01)');
  });

  it('caps the message at six stickers', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ label: `FR${i}`, count: 1, lastAt: '2026-11-26T01:00:00Z', lastBy: null }));
    const msg = buildReprintMessage(many);
    expect(msg).toContain('• FR5');
    expect(msg).not.toContain('• FR6');
    expect(msg).toContain('และอีก 2 รายการ');
  });
});

describe('print history page', () => {
  it('marks a repeat of the same sticker as a reprint', () => {
    const rows = svc.markReprints([
      { id: 1, tracking_code: 'FR1', sticker_format: 'A5', pallet_index: 1, pallet_total: 2 },
      { id: 2, tracking_code: 'FR1', sticker_format: 'A5', pallet_index: 2, pallet_total: 2 },
      { id: 3, tracking_code: 'FR1', sticker_format: 'A5', pallet_index: 1, pallet_total: 2 },
      { id: 4, tracking_code: 'FR1', sticker_format: 'THERMAL', location_code: null },
    ]);
    expect(rows.map((r) => r.isReprint)).toEqual([false, false, true, false]);
    expect(summarizePrintRows(rows)).toMatchObject({ sheets: 4, codes: 1, reprints: 1 });
  });

  it('lists rows newest first, filters to reprints and sends the date range', async () => {
    db.selectRows = [
      { id: 'a', tracking_code: 'FR1', sticker_format: 'A5', pallet_index: 1, pallet_total: 1, printed_at: '2026-11-26T01:00:00Z', printed_by_email: 'a@x' },
      { id: 'b', tracking_code: 'FR1', sticker_format: 'A5', pallet_index: 1, pallet_total: 1, printed_at: '2026-11-26T02:00:00Z', printed_by_email: 'b@x' },
    ];
    render(<StickerPrintHistoryPage />);
    const rows = await screen.findAllByTestId('sticker-print-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('b@x');
    expect(rows[0]).toHaveTextContent('พิมพ์ซ้ำ');
    expect(rows[1]).not.toHaveTextContent('พิมพ์ซ้ำ');
    expect(db.calls.some(([m, col]) => m === 'gte' && col === 'printed_at')).toBe(true);

    fireEvent.click(screen.getByTestId('sticker-print-filter-reprints'));
    fireEvent.change(screen.getByTestId('sticker-print-filter-code'), { target: { value: 'FR1' } });
    fireEvent.click(screen.getByTestId('sticker-print-search'));
    await vi.waitFor(() => expect(screen.getAllByTestId('sticker-print-row')).toHaveLength(1));
    expect(db.calls.some(([m, col, v]) => m === 'ilike' && col === 'tracking_code' && v === '%FR1%')).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';

// When the picked view can't be read, the pallet list is an estimate: it may
// include pallets that are already empty, so a scan must not auto-confirm.

function table(rows, error = null) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    range: () => query,
    then: (resolve, reject) => Promise.resolve(error ? { data: null, error } : { data: rows, error: null }).then(resolve, reject),
  };
  return query;
}

async function loadService({ viewError = null, viewRows = [] }) {
  vi.resetModules();
  vi.doMock('../../src/services/supabaseClient.js', () => ({
    supabase: {
      from: (name) => {
        if (name === 'tgd_customer_deposit_line_locations') {
          return table([{ id: 'alloc-1', location_id: 'l1', pallet_no: 1, boxes: 10, weight: null, tgd_locations: { location_code: 'A-1' } }]);
        }
        if (name === 'tgd_deposit_line_location_picked') return table(viewRows, viewError);
        if (name === 'tgd_customer_withdrawal_line_pallet_picks') return table([]);
        throw new Error(name);
      },
    },
  }));
  return import('../../src/services/customerWithdrawalRequestService.js');
}

describe('listPickablePalletsForDepositLine', () => {
  it('uses the view and is not an estimate when the view answers', async () => {
    const { listPickablePalletsForDepositLine, canAutoConfirmPalletPick } = await loadService({
      viewRows: [{ allocation_id: 'alloc-1', picked_boxes: 4, picked_weight: 0 }],
    });
    const result = await listPickablePalletsForDepositLine('line-1');
    expect(result.isEstimate).toBe(false);
    expect(result.data[0].remainingBoxes).toBe(6);
    expect(canAutoConfirmPalletPick(result)).toBe(true);
  });

  it('flags the list and blocks auto-confirm when the view fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { listPickablePalletsForDepositLine, canAutoConfirmPalletPick } = await loadService({ viewError: { message: 'timeout' } });
    const result = await listPickablePalletsForDepositLine('line-1');
    expect(result.isEstimate).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(canAutoConfirmPalletPick(result)).toBe(false);
    warn.mockRestore();
  });
});

describe('canAutoConfirmPalletPick', () => {
  it('still sends several pallets to the manual choice', async () => {
    const { canAutoConfirmPalletPick } = await loadService({});
    expect(canAutoConfirmPalletPick({ data: [{}, {}], isEstimate: false })).toBe(false);
  });

  it('keeps the whole-line path for a line with no pallets', async () => {
    const { canAutoConfirmPalletPick } = await loadService({});
    expect(canAutoConfirmPalletPick({ data: [] })).toBe(true);
  });
});

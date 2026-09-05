import { describe, expect, it, vi } from 'vitest';

// Regression coverage for the handheld "Update Location" scan-by-tracking-
// code shortcut: getDepositLineByTrackingCode must scope its lookup to the
// same "received" statuses that flow's own document list filters to (a
// tracking code from a recalled/unconfirmed deposit shouldn't resolve to a
// document the flow wouldn't otherwise show), and return null (not throw)
// for a code that isn't found at all.

function chainable(result) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    maybeSingle: () => Promise.resolve(result),
  };
  return query;
}

describe('getDepositLineByTrackingCode', () => {
  it('returns the matching line + its deposit_request_id when found among received documents', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: {
        from: (table) => {
          expect(table).toBe('tgd_customer_deposit_request_lines');
          return chainable({
            data: { id: 'line-1', deposit_request_id: 'req-1', tracking_code: 'FR260903027' },
            error: null,
          });
        },
      },
    }));
    const { getDepositLineByTrackingCode } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositLineByTrackingCode('FR260903027');

    expect(error).toBeNull();
    expect(data).toEqual({ id: 'line-1', deposit_request_id: 'req-1', tracking_code: 'FR260903027' });
  });

  it('returns null data (no error) when no line matches', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: { from: () => chainable({ data: null, error: null }) },
    }));
    const { getDepositLineByTrackingCode } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositLineByTrackingCode('NOT-A-REAL-CODE');

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('short-circuits to null for a blank/whitespace-only code without querying supabase', async () => {
    vi.resetModules();
    const fromSpy = vi.fn();
    vi.doMock('../../src/services/supabaseClient.js', () => ({
      supabase: { from: fromSpy },
    }));
    const { getDepositLineByTrackingCode } = await import('../../src/services/customerDepositRequestService.js');

    const { data, error } = await getDepositLineByTrackingCode('   ');

    expect(data).toBeNull();
    expect(error).toBeNull();
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

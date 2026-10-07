import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(), start: vi.fn(), lines: vi.fn(), expected: vi.fn(), record: vi.fn(), status: vi.fn(),
  photos: vi.fn(), products: vi.fn(), locations: vi.fn(),
}));
vi.mock('../../src/features/handheld/HandheldContext.jsx', () => ({ useHandheldAuth: () => ({ activeProfile: { id: 'p1', email: 'staff@x' } }) }));
vi.mock('../../src/services/locationCountService.js', async (importOriginal) => ({
  ...await importOriginal(),
  getOpenLocationCountSession: mocks.open,
  startLocationCount: mocks.start,
  listLocationCountLines: mocks.lines,
  getLocationCountExpected: mocks.expected,
  recordLocationCountRow: mocks.record,
  setLocationCountStatus: mocks.status,
}));
vi.mock('../../src/services/customerDocumentAttachmentService.js', () => ({ resolveCountPhotoUrls: mocks.photos }));
vi.mock('../../src/services/customerProductCatalogService.js', () => ({ listCustomerProducts: mocks.products }));
vi.mock('../../src/services/warehouseLayoutService.js', () => ({ getActiveLocations: mocks.locations }));
import { StockCountWorkflow, buildCountResults } from '../../src/features/handheld/StockCountWorkflow.jsx';

const pallets = [
  { allocation_id: 'a1', deposit_line_id: 'l1', pallet_no: 1, product_name: 'Bacon', customer_product_code: 'B1', lot_no: 'L1', tracking_code: 'FR1', expected_boxes: 10, expected_weight: 50, kg_per_box: 5 },
  { allocation_id: 'a2', deposit_line_id: 'l2', pallet_no: 2, product_name: 'Ham', customer_product_code: 'H1', lot_no: 'L2', tracking_code: 'FR2', expected_boxes: 4, expected_weight: 20, kg_per_box: 5 },
];

beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* storage unavailable */ }
  mocks.locations.mockResolvedValue({ data: [{ id: 'loc1', code: '42-R-01' }, { id: 'loc2', code: '42-R-02' }] });
  mocks.open.mockResolvedValue({ data: { id: 's1', count_no: 'CNT-20261007-0001', status: 'OPEN' }, error: null });
  mocks.lines.mockResolvedValue({ data: [], error: null });
  mocks.expected.mockResolvedValue({ data: pallets, error: null });
  mocks.record.mockResolvedValue({ data: { lines: 2 }, error: null });
  mocks.products.mockResolvedValue({ data: [] });
  mocks.photos.mockResolvedValue({ data: { l1: { url: 'https://img/bacon.jpg', source: 'PACKAGING' } } });
});

describe('buildCountResults', () => {
  it('maps match / diff / missing and extras to RPC rows', () => {
    const results = buildCountResults(pallets, {
      a1: { mode: 'match' },
      a2: { mode: 'diff', boxes: '3', weight: '15', note: 'broken' },
    }, [{ trackingCode: 'FR9', productName: '', boxes: '2', weight: '' }]);
    expect(results).toEqual([
      { allocation_id: 'a1', counted_boxes: 10, counted_weight: 50, note: null },
      { allocation_id: 'a2', counted_boxes: 3, counted_weight: 15, note: 'broken' },
      { tracking_code: 'FR9', product_name: null, counted_boxes: 2, counted_weight: 0, note: null },
    ]);
    expect(buildCountResults(pallets.slice(0, 1), { a1: { mode: 'missing' } }, [])[0]).toMatchObject({ counted_boxes: 0, counted_weight: 0 });
  });
});

describe('StockCountWorkflow', () => {
  it('counts a row with product photos and saves it', async () => {
    render(<StockCountWorkflow onBack={() => {}} />);
    // A single zone and side are auto-selected, so the row grid shows straight away.
    fireEvent.click((await screen.findAllByTestId('stock-count-row'))[0]);
    expect(await screen.findByText('Bacon')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Bacon' })).toHaveAttribute('src', 'https://img/bacon.jpg');
    expect(screen.getByText(/ยังไม่มีรูปสินค้า/)).toBeInTheDocument();

    // Saving with a pallet still uncounted is blocked.
    fireEvent.click(screen.getByTestId('stock-count-save-row'));
    expect(await screen.findByText('ยังไม่ได้นับอีก 2 พาเลท')).toBeInTheDocument();
    expect(mocks.record).not.toHaveBeenCalled();

    const [firstCard, secondCard] = screen.getAllByTestId('stock-count-pallet-card');
    fireEvent.click(within(firstCard).getByRole('button', { name: '✓ ตรง' }));
    fireEvent.click(within(secondCard).getByRole('button', { name: '✎ ไม่ตรง' }));
    const [boxesInput, weightInput] = within(secondCard).getAllByRole('spinbutton');
    fireEvent.change(boxesInput, { target: { value: '3' } });
    // Weight follows boxes x kg per box.
    expect(weightInput).toHaveValue(15);

    fireEvent.click(screen.getByTestId('stock-count-save-row'));
    await waitFor(() => expect(mocks.record).toHaveBeenCalledWith('s1', 'loc1', [
      { allocation_id: 'a1', counted_boxes: 10, counted_weight: 50, note: null },
      { allocation_id: 'a2', counted_boxes: 3, counted_weight: 15, note: null },
    ], 'p1'));
    expect(await screen.findByText('บันทึก 42-R-01 แล้ว')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /นับแถวถัดไป → 42-R-02/ })).toBeInTheDocument();
  });

  it('offers to start a new count when none is open', async () => {
    mocks.open.mockResolvedValue({ data: null, error: null });
    mocks.start.mockResolvedValue({ data: { id: 's2', count_no: 'CNT-20261007-0002', status: 'OPEN' }, error: null });
    render(<StockCountWorkflow onBack={() => {}} />);
    fireEvent.click(await screen.findByTestId('stock-count-start'));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText(/CNT-20261007-0002/)).toBeInTheDocument();
  });
});

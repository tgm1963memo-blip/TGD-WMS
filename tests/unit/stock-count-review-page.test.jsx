import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sessions: vi.fn(), lines: vi.fn(), status: vi.fn(), photos: vi.fn(), download: vi.fn(), role: 'warehouse_manager' }));
vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({ useUserRole: () => ({ role: mocks.role }) }));
vi.mock('../../src/services/locationCountService.js', async (importOriginal) => ({
  ...await importOriginal(),
  listLocationCountSessions: mocks.sessions,
  listLocationCountLines: mocks.lines,
  setLocationCountStatus: mocks.status,
}));
vi.mock('../../src/services/customerProductCatalogService.js', () => ({ listCustomerProducts: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../src/services/customerDocumentAttachmentService.js', () => ({ resolveCountPhotoUrls: mocks.photos }));
vi.mock('../../src/utils/excelFileUtils.js', () => ({ downloadExcelRows: mocks.download }));
import { StockCountReviewPage } from '../../src/features/inventory/StockCountReviewPage.jsx';

const session = { id: 's1', count_no: 'CNT-20261007-0001', status: 'SUBMITTED', started_at: '2026-10-07T03:00:00Z', started_by_email: 'staff@x', locationCount: 1, lineCount: 2, varianceCount: 1 };
const lines = [
  { id: 'n1', location_id: 'loc1', location_code: '42-R-11', pallet_no: 1, deposit_line_id: 'l1', product_name: 'Bacon', expected_boxes: 100, counted_boxes: 99, expected_weight: 500, counted_weight: 495, result: 'SHORT', note: 'broken box' },
  { id: 'n2', location_id: 'loc1', location_code: '42-R-11', pallet_no: 2, deposit_line_id: 'l2', product_name: 'Ham', expected_boxes: 50, counted_boxes: 50, expected_weight: 250, counted_weight: 250, result: 'MATCH' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessions.mockResolvedValue({ data: [session], error: null });
  mocks.lines.mockResolvedValue({ data: lines, error: null });
  mocks.photos.mockResolvedValue({ data: {} });
  mocks.status.mockResolvedValue({ data: { ...session, status: 'REVIEWED' }, error: null });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('StockCountReviewPage', () => {
  it('shows only variances by default, exports all lines and marks the count reviewed', async () => {
    render(<MemoryRouter><StockCountReviewPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'ดูผล' }));
    expect(await screen.findByText('Bacon')).toBeInTheDocument();
    expect(screen.getByText('42-R-11-01')).toBeInTheDocument();
    expect(screen.queryByText('Ham')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stock-count-variance-only'));
    expect(screen.getByText('Ham')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
    const [rows] = mocks.download.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ 'พาเลท': '42-R-11-01', 'ต่าง (กล่อง)': -1, 'ผล': 'ขาด' });

    fireEvent.click(screen.getByTestId('stock-count-mark-reviewed'));
    await waitFor(() => expect(mocks.status).toHaveBeenCalledWith('s1', 'REVIEWED', { note: '' }));
  });
});

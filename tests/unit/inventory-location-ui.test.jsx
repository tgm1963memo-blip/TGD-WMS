import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  role: 'warehouse_admin', list: vi.fn(), editor: vi.fn(), slots: vi.fn(), move: vi.fn(), add: vi.fn(), download: vi.fn(), saved: vi.fn(),
}));
vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({ useUserRole: () => ({ role: mocks.role }) }));
vi.mock('../../src/services/inventoryLocationService.js', async importOriginal => ({
  ...await importOriginal(), listInventoryLocations: mocks.list, getInventoryLocationEditor: mocks.editor,
  getInventoryLocationSlots: mocks.slots, moveInventoryPallet: mocks.move, addInventoryPallet: mocks.add,
}));
vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  getAllCustomerStockBalances: vi.fn().mockResolvedValue({ data: [{ id: 'l1', tracking_code: 'FR1', product_name: 'Test product', customer_product_code: 'P1', actual_boxes: 3, actual_weight: 30, request: { id: 'r1', customer_id: 'c1', request_no: 'CDR1' } }], error: null }),
  getAllPendingDepositTotals: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock('../../src/services/customerWithdrawalRequestService.js', () => ({ getAllPendingWithdrawalTotals: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../src/services/customerProductCatalogService.js', () => ({ listCustomerProducts: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../src/services/masterDataService.js', () => ({ getCustomers: vi.fn().mockResolvedValue({ data: [{ id: 'c1', customer_name: 'Customer' }] }) }));
vi.mock('../../src/services/warehouseLayoutService.js', () => ({ getActiveLocations: vi.fn().mockResolvedValue({ data: [{ id: 'dest', code: '42-L-02', capacity: 3 }] }) }));
vi.mock('../../src/components/customer/CustomerDepositDetailModal.jsx', () => ({ CustomerDepositDetailModal: () => null }));
vi.mock('../../src/utils/excelFileUtils.js', () => ({ downloadExcelRows: mocks.download }));
import { InventoryBalancePage } from '../../src/features/inventory/InventoryBalancePage.jsx';
import { InventoryLocationModal } from '../../src/features/inventory/InventoryLocationModal.jsx';

const allocation = { id: 'a1', lineId: 'l1', locationId: 'old', palletNo: 1, palletCode: '42-L-01-01', active: true, remainingBoxes: 5, remainingWeight: 50 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = 'warehouse_admin';
  mocks.list.mockResolvedValue({ data: new Map([['l1', [allocation]]]), error: null });
  mocks.editor.mockResolvedValue({ data: { allocations: [allocation], unallocatedBoxes: 10, unallocatedWeight: 100 }, error: null });
  mocks.slots.mockResolvedValue({ data: [{ id: 'occupied', palletNo: 1 }], error: null });
  mocks.move.mockResolvedValue({ data: {}, error: null });
  mocks.add.mockResolvedValue({ data: {}, error: null });
});

describe('inventory balance locations', () => {
  it('displays, searches and exports location, and disables editing for historical balances', async () => {
    render(<InventoryBalancePage />);
    await screen.findByText('Test product');
    fireEvent.click(screen.getByRole('button', { name: /ขยายทั้งหมด/ }));
    await screen.findByText('42-L-01-01');
    expect(screen.getByRole('button', { name: 'จัดการ Location' })).toBeEnabled();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '42-L-01' } });
    expect(screen.getByText('FR1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('inventory-balance-export-excel'));
    expect(mocks.download.mock.calls[0][0][0]['Location ปัจจุบัน / พาเลท']).toBe('42-L-01-01');
    fireEvent.change(screen.getByTestId('inventory-balance-as-of-date'), { target: { value: '2026-09-01' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'จัดการ Location' })).not.toBeInTheDocument());
    expect(screen.getByText(/ไม่ใช่ตำแหน่งย้อนหลัง/)).toBeInTheDocument();
  });
  it('shows read-only locations to staff', async () => {
    mocks.role = 'warehouse_staff';
    render(<InventoryBalancePage />);
    await screen.findByText('Test product');
    fireEvent.click(screen.getByRole('button', { name: /ขยายทั้งหมด/ }));
    await screen.findByText('42-L-01-01');
    expect(screen.queryByRole('button', { name: 'จัดการ Location' })).not.toBeInTheDocument();
  });
  it('reports location errors and prevents incomplete exports', async () => {
    mocks.list.mockResolvedValue({ data: null, error: new Error('offline') });
    render(<InventoryBalancePage />);
    await screen.findByText(/โหลด Location ไม่สำเร็จ: offline/);
    expect(screen.getByTestId('inventory-balance-export-excel')).toBeDisabled();
  });
});

describe('inventory location editor', () => {
  async function chooseDestination() {
    fireEvent.change(screen.getByLabelText('Location ปลายทาง'), { target: { value: 'dest' } });
    await waitFor(() => expect(screen.getByLabelText('ช่องพาเลทปลายทาง')).toBeEnabled());
    expect(within(screen.getByLabelText('ช่องพาเลทปลายทาง')).queryByRole('option', { name: '1', exact: true })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('ช่องพาเลทปลายทาง'), { target: { value: '2' } });
  }
  function show() { render(<InventoryLocationModal line={{ id: 'l1', tracking_code: 'FR1' }} onClose={vi.fn()} onSaved={mocks.saved} />); }
  it('moves just the selected allocation with its original position and refreshes after save', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'ย้ายพาเลท' }));
    await chooseDestination();
    expect(screen.getByText('42-L-01-01 → 42-L-02-02')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Location' }));
    await waitFor(() => expect(mocks.move).toHaveBeenCalledWith(allocation, 'dest', '2'));
    await waitFor(() => expect(mocks.saved).toHaveBeenCalledTimes(1));
  });
  it('adds a partial allocation and preserves the entered form on server failure', async () => {
    mocks.add.mockResolvedValueOnce({ error: new Error('ช่องไม่ว่าง') });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'เพิ่ม Location' }));
    await chooseDestination();
    fireEvent.change(screen.getByLabelText('กล่องที่จัดเก็บ'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('น้ำหนักที่จัดเก็บ (กก.)'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Location' }));
    await screen.findByText('ช่องไม่ว่าง');
    expect(screen.getByLabelText('กล่องที่จัดเก็บ')).toHaveValue(4);
    expect(mocks.saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Location' }));
    await waitFor(() => expect(mocks.add).toHaveBeenLastCalledWith('l1', 'dest', '2', 4, 40));
    await screen.findByText('บันทึก Location สำเร็จ');
  });
  it('offers adding storage for an unassigned lot', async () => {
    mocks.editor.mockResolvedValue({ data: { allocations: [], unallocatedBoxes: 10, unallocatedWeight: 100 } });
    show();
    await screen.findByText(/ยังไม่กำหนด Location หรือ/);
    expect(screen.getByRole('button', { name: 'เพิ่ม Location' })).toBeEnabled();
  });
});

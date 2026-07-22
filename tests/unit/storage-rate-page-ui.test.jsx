import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/masterDataService.js', () => ({
  getCustomers: vi.fn().mockResolvedValue({
    data: [{ id: 'cust-1', customer_code: 'CUST-001', customer_name: 'Alpha Cold' }],
  }),
}));

vi.mock('../../src/services/customerProductCatalogService.js', () => ({
  listCustomerProducts: vi.fn().mockResolvedValue({
    data: [{ id: 'cp-1', customer_product_code: 'SKU-1', product_name: 'Frozen Shrimp', customer_id: 'cust-1' }],
  }),
  upsertCustomerProduct: vi.fn(),
}));

vi.mock('../../src/services/productServiceRatesService.js', async () => {
  const actual = await vi.importActual('../../src/services/productServiceRatesService.js');
  return {
    ...actual,
    listAllProductServiceRates: vi.fn().mockResolvedValue({
      data: [{
        id: 'rate-1',
        customer_product_id: 'cp-1',
        service_type: 'STORAGE',
        rate: 2.5,
        unit_basis: 'PER_KG',
        currency: 'THB',
        note: null,
        is_active: true,
        customer_id: 'cust-1',
        customer_code: 'CUST-001',
        customer_name: 'Alpha Cold',
        customer_product_code: 'SKU-1',
        product_name: 'Frozen Shrimp',
      }],
      error: null,
    }),
    listCustomerProductsForRateImport: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsertProductServiceRate: vi.fn(),
    bulkUpsertProductServiceRates: vi.fn(),
  };
});

const { CustomerProductServiceRatesPage } = await import('../../src/features/admin/CustomerProductServiceRatesPage.jsx');

describe('CustomerProductServiceRatesPage', () => {
  it('renders the full rate table (not gated behind picking a single product) plus the import/export toolbar', async () => {
    render(<CustomerProductServiceRatesPage />);

    await waitFor(() => expect(screen.getByTestId('storage-rate-table')).toBeInTheDocument());
    expect(await screen.findByText('Alpha Cold')).toBeInTheDocument();
    expect(screen.getByText('Frozen Shrimp')).toBeInTheDocument();
    expect(screen.getByTestId('excel-import-export-toolbar')).toBeInTheDocument();
    expect(screen.getByText('+ เพิ่มอัตราค่าบริการ')).toBeInTheDocument();
  });

  it('scopes new STORAGE rates to a storage method only — no individual product or unscoped "all items" option', async () => {
    render(<CustomerProductServiceRatesPage />);
    await waitFor(() => expect(screen.getByTestId('storage-rate-table')).toBeInTheDocument());

    fireEvent.click(screen.getByText('+ เพิ่มอัตราค่าบริการ'));

    const customerLabel = await screen.findByText('ลูกค้า *');
    const customerSelect = customerLabel.closest('label').querySelector('select');
    fireEvent.change(customerSelect, { target: { value: 'cust-1' } });

    // Default service type is STORAGE, so the scope select must only offer
    // the storage-method categories — no raw product list (once loaded for
    // the selected customer), no unscoped "ทุกรายการ (ทุกอุณหภูมิ)" bucket.
    const scopeLabel = await screen.findByText('วิธีการจัดเก็บ *');
    const scopeSelect = scopeLabel.closest('label').querySelector('select');
    await waitFor(() => {
      const optionTexts = Array.from(scopeSelect.querySelectorAll('option')).map((o) => o.textContent);
      expect(optionTexts.some((t) => t.includes('Frozen Shrimp'))).toBe(false);
    });
    const optionTexts = Array.from(scopeSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionTexts).not.toContain('— ทุกรายการ (ทุกอุณหภูมิ) —');
    expect(optionTexts.some((t) => t.includes('FROZEN'))).toBe(true);

    // Switching the service type away from STORAGE brings back the normal
    // per-product / unscoped options.
    const serviceTypeInput = screen.getByPlaceholderText('เลือกหรือพิมพ์ประเภทค่าบริการใหม่');
    fireEvent.change(serviceTypeInput, { target: { value: 'HANDLING_IN' } });
    const productLabel = await screen.findByText('สินค้า *');
    const productSelect = productLabel.closest('label').querySelector('select');
    await waitFor(() => {
      const productOptionTexts = Array.from(productSelect.querySelectorAll('option')).map((o) => o.textContent);
      expect(productOptionTexts.some((t) => t.includes('Frozen Shrimp'))).toBe(true);
    });
  });
});

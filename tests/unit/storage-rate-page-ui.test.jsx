import { render, screen, waitFor } from '@testing-library/react';
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
});

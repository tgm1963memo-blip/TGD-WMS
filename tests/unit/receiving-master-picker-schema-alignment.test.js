import { describe, expect, it, vi } from 'vitest';

const { tableRows, fromCalls, selectCalls } = vi.hoisted(() => ({
  tableRows: {
    tgd_customers: [
      {
        id: 'customer-actual-1',
        name: 'Actual Staging Customer',
        contact_email: 'customer@example.com',
      },
      {
        id: 'customer-id-only',
      },
    ],
    tgd_products: [
      {
        id: 'product-code-name',
        sku: 'SKU-001',
        name: 'Schema Safe Product',
      },
      {
        id: 'product-id-only',
      },
    ],
    tgd_lots: [
      {
        id: 'lot-number-1',
        lot_number: 'LOT-ACTUAL-1',
        product_id: 'product-code-name',
      },
      {
        id: 'lot-id-only',
      },
    ],
    tgd_locations: [
      {
        id: 'location-code-name',
        code: 'LOC-A1',
        name: 'Schema Safe Location',
      },
      {
        id: 'location-id-only',
      },
    ],
  },
  fromCalls: [],
  selectCalls: [],
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    from: (tableName) => {
      fromCalls.push(tableName);

      return {
        select: async (columns) => {
          selectCalls.push({ tableName, columns });

          return {
            data: tableRows[tableName] ?? [],
            error: null,
          };
        },
      };
    },
  },
}));

const {
  getReceivingCustomers,
  getReceivingProducts,
  getReceivingLots,
  getReceivingLocations,
} = await import('../../src/services/receivingService.js');

describe('Sprint 13J-AL-FIX1 receiving master picker schema alignment', () => {
  it('customer lookup supports actual Staging id/name schema and id fallback', async () => {
    const { data, error } = await getReceivingCustomers();

    expect(error).toBeNull();
    expect(data).toContainEqual({
      id: 'customer-actual-1',
      code: null,
      name: 'Actual Staging Customer',
      label: 'Actual Staging Customer',
    });
    expect(data).toContainEqual({
      id: 'customer-id-only',
      code: null,
      name: null,
      label: 'customer-id-only',
    });
  });

  it('product, lot, and location lookups use schema-safe code/name fallbacks', async () => {
    const products = await getReceivingProducts();
    const lots = await getReceivingLots();
    const locations = await getReceivingLocations();

    expect(products.data).toContainEqual(expect.objectContaining({
      id: 'product-code-name',
      code: 'SKU-001',
      name: 'Schema Safe Product',
      label: 'SKU-001 - Schema Safe Product',
    }));
    expect(products.data).toContainEqual(expect.objectContaining({
      id: 'product-id-only',
      code: null,
      name: null,
      label: 'product-id-only',
    }));

    expect(lots.data).toContainEqual({
      id: 'lot-number-1',
      lot_no: 'LOT-ACTUAL-1',
      code: 'LOT-ACTUAL-1',
      name: 'LOT-ACTUAL-1',
      product_id: 'product-code-name',
      customer_id: null,
      label: 'LOT-ACTUAL-1',
    });
    expect(lots.data).toContainEqual({
      id: 'lot-id-only',
      lot_no: null,
      code: null,
      name: null,
      product_id: null,
      customer_id: null,
      label: 'lot-id-only',
    });

    expect(locations.data).toContainEqual({
      id: 'location-code-name',
      code: 'LOC-A1',
      name: 'Schema Safe Location',
      label: 'LOC-A1 - Schema Safe Location',
    });
    expect(locations.data).toContainEqual({
      id: 'location-id-only',
      code: null,
      name: null,
      label: 'location-id-only',
    });
  });

  it('picker lookups select all available columns read-only without RPC or DML', async () => {
    await getReceivingCustomers();
    await getReceivingProducts();
    await getReceivingLots();
    await getReceivingLocations();

    expect(fromCalls).toEqual(expect.arrayContaining([
      'tgd_customers',
      'tgd_products',
      'tgd_lots',
      'tgd_locations',
    ]));
    expect(selectCalls).toEqual(expect.arrayContaining([
      { tableName: 'tgd_customers', columns: 'id, name' },
      { tableName: 'tgd_products', columns: 'id, sku, name, unit' },
      { tableName: 'tgd_lots', columns: 'id, lot_number, product_id, customer_id' },
      { tableName: 'tgd_locations', columns: 'id, code, name, description' },
    ]));
  });
});

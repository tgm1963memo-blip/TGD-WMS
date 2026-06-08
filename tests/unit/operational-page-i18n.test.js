import { describe, it, expect } from 'vitest';
import { TRANSLATION_CATALOG } from '../../src/i18n/translationCatalog.js';

describe('19C Operational Page i18n Cleanup', () => {
  it('contains required operational page keys in translationCatalog', () => {
    const requiredKeys = [
      'search', 'reset', 'view_detail', 'status', 'customer', 'warehouse',
      'date_from', 'date_to', 'actions', 'type', 'created_at', 'document_no',
      'product', 'lot', 'pallet', 'quantity', 'location',
      'source_location', 'destination_location',
      'receiving_no', 'putaway_no', 'transfer_no'
    ];

    requiredKeys.forEach(key => {
      expect(TRANSLATION_CATALOG).toHaveProperty(key);
      expect(TRANSLATION_CATALOG[key]).toHaveProperty('th');
      expect(TRANSLATION_CATALOG[key]).toHaveProperty('en');
    });
  });

  it('preserves sidebar nav keys from 19B', () => {
    expect(TRANSLATION_CATALOG['nav.dashboard']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.receiving']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.inventoryControl']).toBeDefined();
  });
});

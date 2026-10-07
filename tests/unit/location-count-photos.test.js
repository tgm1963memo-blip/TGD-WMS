import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/services/supabaseClient.js', () => ({ supabase: null }));
import { pickCountPhotoAttachments, productPhotoKey } from '../../src/services/customerDocumentAttachmentService.js';

describe('pickCountPhotoAttachments', () => {
  const items = [
    { deposit_line_id: 'l1', customer_id: 'c1', customer_product_code: 'P1' },
    { deposit_line_id: 'l2', customer_id: 'c1', customer_product_code: 'P2' },
    { deposit_line_id: 'l3', customer_id: 'c1', customer_product_code: 'P3' },
  ];
  const productIdByKey = new Map([
    [productPhotoKey('c1', 'p1'), 'prod1'],
    [productPhotoKey('c1', 'P2'), 'prod2'],
  ]);

  it('prefers the newest packaging photo, then the first receiving photo, else nothing', () => {
    const chosen = pickCountPhotoAttachments(items, productIdByKey, [
      { id: 'pk-old', document_id: 'prod1', created_at: '2026-01-01' },
      { id: 'pk-new', document_id: 'prod1', created_at: '2026-05-01' },
    ], [
      { id: 'rc-1', document_id: 'l1', created_at: '2026-02-01' },
      { id: 'rc-late', document_id: 'l2', created_at: '2026-03-02' },
      { id: 'rc-early', document_id: 'l2', created_at: '2026-03-01' },
    ]);
    expect(chosen.l1.id).toBe('pk-new');
    expect(chosen.l2.id).toBe('rc-early');
    expect(chosen.l3).toBeUndefined();
  });
});

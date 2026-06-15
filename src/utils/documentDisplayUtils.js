export function formatDocumentDate(value, { dateOnly = false } = {}) {
  if (!value) return '-';

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    if (dateOnly) {
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }

    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

export function isDateColumnKey(key) {
  if (!key) return false;
  if (key === 'created_at' || key === 'updated_at') return true;
  return key.endsWith('_date') || key.endsWith('_at');
}

export function shouldUseDateOnlyFormat(key) {
  return key.endsWith('_date') && key !== 'created_at' && key !== 'updated_at';
}

const META_COLUMN_KEYS = new Set([
  'warehouse_id',
  'customer_id',
  'from_warehouse_id',
  'to_warehouse_id',
  'source_id',
  'withdrawal_request_id',
  'allocation_id',
  'picking_document_id',
  'product_id',
  'lot_id',
  'location_id',
]);

export function isMetaColumnKey(key) {
  if (!key) return false;
  if (META_COLUMN_KEYS.has(key)) return true;
  return key.endsWith('_type') || key.endsWith('_method');
}

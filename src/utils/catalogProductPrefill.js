// "สร้างสินค้า" links from the deposit batch import open a catalog page with
// ?newCode=…&name=…&weight=…&temp=… so the add-product form starts filled in.

const PREFILL_PARAMS = ['newCode', 'name', 'weight', 'temp'];

// The catalog stores FROZEN / CHILLED / AMBIENT; the deposit storage modes
// (FREEZE, FREEZE_FROZEN) are all frozen goods.
export function readNewProductPrefill(searchParams) {
  const code = String(searchParams.get('newCode') ?? '').trim();
  if (!code) return null;
  const weight = String(searchParams.get('weight') ?? '').trim();
  return {
    customerProductCode: code,
    productName: String(searchParams.get('name') ?? '').trim(),
    packWeightKg: Number(weight) > 0 ? weight : '',
    temperatureType: searchParams.get('temp') === 'CHILLED' ? 'CHILLED' : 'FROZEN',
  };
}

export function withoutNewProductPrefill(searchParams) {
  const next = new URLSearchParams(searchParams);
  PREFILL_PARAMS.forEach((key) => next.delete(key));
  return next;
}

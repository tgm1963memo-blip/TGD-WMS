// Compares a withdrawal's net weight per ร.3 carcass type against the kg
// the ร.3 permit(s) allow. Warn-only — callers decide how to surface it.

export const R3_STATUS = {
  OK: 'OK',
  OVER: 'OVER',
  NOT_ON_PERMIT: 'NOT_ON_PERMIT',
  UNCATEGORIZED: 'UNCATEGORIZED',
};

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

// Same rule as confirmedQty() in CustomerWithdrawalRequestPrintDocument:
// once picked, the confirmed weight wins over what was requested.
export function r3LineWeightKg(line, usePicked = false) {
  const value = usePicked
    ? line?.picked_weight ?? line?.requested_weight
    : line?.requested_weight;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// The line's own snapshot wins; unsaved lines fall back to the catalog.
export function resolveLineR3Code(line, catalogR3Map) {
  const own = String(line?.r3_carcass_type_code ?? '').trim();
  if (own) return own;
  const code = String(line?.customer_product_code ?? '').trim();
  if (!code || !catalogR3Map) return null;
  const fromCatalog = catalogR3Map instanceof Map ? catalogR3Map.get(code) : catalogR3Map[code];
  return String(fromCatalog ?? '').trim() || null;
}

// Excel/paste import: accepts the code ("PORK_FAT_FROZEN"), the Thai label
// ("มันสุกรแช่แข็ง") or "animal / label" ("สุกร / มันสุกรแช่แข็ง").
// Returns null when blank or unrecognised.
export function resolveR3CarcassTypeCode(raw, carcassTypes = []) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();
  const target = norm(text);
  const hit = carcassTypes.find((t) => (
    norm(t.code) === target
    || norm(t.label_th) === target
    || norm(`${t.animal_type}/${t.label_th}`) === target
  ));
  return hit?.code ?? null;
}

export function formatR3CarcassType(code, carcassTypes = []) {
  if (!code) return '-';
  const type = carcassTypes.find((t) => t.code === code);
  return type ? `${type.animal_type} / ${type.label_th}` : code;
}

export function buildCatalogR3Map(products = []) {
  const map = new Map();
  for (const p of products) {
    const code = String(p?.customer_product_code ?? '').trim();
    const r3 = String(p?.r3_carcass_type_code ?? '').trim();
    if (code && r3) map.set(code, r3);
  }
  return map;
}

export function compareR3Permit({
  lines = [],
  permitItems = [],
  carcassTypes = [],
  catalogR3Map = null,
  usePicked = false,
} = {}) {
  const typeByCode = new Map(carcassTypes.map((t) => [t.code, t]));
  const permitted = new Map();
  const permitNos = new Map();
  for (const item of permitItems) {
    const code = String(item?.r3_carcass_type_code ?? '').trim();
    if (!code) continue;
    permitted.set(code, (permitted.get(code) ?? 0) + Number(item.permitted_kg || 0));
    const no = String(item?.r3_no ?? '').trim();
    if (no) {
      if (!permitNos.has(code)) permitNos.set(code, new Set());
      permitNos.get(code).add(no);
    }
  }

  const actual = new Map();
  const productCodesByType = new Map();
  let uncategorizedKg = 0;
  const uncategorizedProducts = new Set();
  for (const line of lines) {
    const kg = r3LineWeightKg(line, usePicked);
    const code = resolveLineR3Code(line, catalogR3Map);
    const productCode = String(line?.customer_product_code ?? '').trim();
    if (!code) {
      uncategorizedKg += kg;
      if (productCode) uncategorizedProducts.add(productCode);
      continue;
    }
    actual.set(code, (actual.get(code) ?? 0) + kg);
    if (productCode) {
      if (!productCodesByType.has(code)) productCodesByType.set(code, new Set());
      productCodesByType.get(code).add(productCode);
    }
  }

  const codes = [...new Set([...permitted.keys(), ...actual.keys()])];
  codes.sort((a, b) => (typeByCode.get(a)?.sort_order ?? 9999) - (typeByCode.get(b)?.sort_order ?? 9999));

  const rows = codes.map((code) => {
    const type = typeByCode.get(code);
    const hasPermit = permitted.has(code);
    const permittedKg = hasPermit ? round2(permitted.get(code)) : null;
    const actualKg = round2(actual.get(code) ?? 0);
    let status = R3_STATUS.OK;
    if (!hasPermit) status = R3_STATUS.NOT_ON_PERMIT;
    else if (actualKg > permittedKg) status = R3_STATUS.OVER;
    return {
      code,
      animalType: type?.animal_type ?? null,
      label: type?.label_th ?? code,
      permittedKg,
      actualKg,
      diffKg: hasPermit ? round2(permittedKg - actualKg) : null,
      r3Nos: [...(permitNos.get(code) ?? [])],
      productCodes: [...(productCodesByType.get(code) ?? [])],
      status,
    };
  });

  if (uncategorizedKg > 0 || uncategorizedProducts.size) {
    rows.push({
      code: null,
      animalType: null,
      label: null,
      permittedKg: null,
      actualKg: round2(uncategorizedKg),
      diffKg: null,
      r3Nos: [],
      productCodes: [...uncategorizedProducts],
      status: R3_STATUS.UNCATEGORIZED,
    });
  }

  return {
    rows,
    hasOver: rows.some((r) => r.status === R3_STATUS.OVER),
    hasNotOnPermit: rows.some((r) => r.status === R3_STATUS.NOT_ON_PERMIT),
    hasUncategorized: rows.some((r) => r.status === R3_STATUS.UNCATEGORIZED),
    hasIssue: rows.some((r) => r.status !== R3_STATUS.OK),
  };
}

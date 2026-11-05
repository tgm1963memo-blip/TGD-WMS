import { describe, expect, it } from 'vitest';
import {
  R3_STATUS,
  buildCatalogR3Map,
  compareR3Permit,
  resolveLineR3Code,
} from '../../src/utils/r3PermitComparisonUtils.js';

const CARCASS_TYPES = [
  { code: 'PORK_MEAT_FROZEN', animal_type: 'สุกร', label_th: 'เนื้อสุกรแช่แข็ง', sort_order: 10 },
  { code: 'PORK_FAT_FROZEN', animal_type: 'สุกร', label_th: 'มันสุกรแช่แข็ง', sort_order: 20 },
];

// CWR-20261105-0002: SPC112 ×3 lots = 500 kg (มันสุกร), SPC067 = 400 kg (เนื้อสุกร)
const LINES = [
  { customer_product_code: 'SPC112', requested_weight: 156, r3_carcass_type_code: 'PORK_FAT_FROZEN' },
  { customer_product_code: 'SPC112', requested_weight: 264, r3_carcass_type_code: 'PORK_FAT_FROZEN' },
  { customer_product_code: 'SPC112', requested_weight: 80, r3_carcass_type_code: 'PORK_FAT_FROZEN' },
  { customer_product_code: 'SPC067', requested_weight: 400, r3_carcass_type_code: 'PORK_MEAT_FROZEN' },
];

const PERMIT = [
  { r3_no: '03692020400001771', r3_carcass_type_code: 'PORK_MEAT_FROZEN', permitted_kg: 400 },
  { r3_no: '03692020400001771', r3_carcass_type_code: 'PORK_FAT_FROZEN', permitted_kg: 500 },
];

describe('compareR3Permit', () => {
  it('passes the real CWR-20261105-0002 case exactly at the permitted kg', () => {
    const result = compareR3Permit({ lines: LINES, permitItems: PERMIT, carcassTypes: CARCASS_TYPES });
    expect(result.hasIssue).toBe(false);
    expect(result.rows.map((r) => [r.label, r.permittedKg, r.actualKg, r.status])).toEqual([
      ['เนื้อสุกรแช่แข็ง', 400, 400, R3_STATUS.OK],
      ['มันสุกรแช่แข็ง', 500, 500, R3_STATUS.OK],
    ]);
    expect(result.rows[1].productCodes).toEqual(['SPC112']);
    expect(result.rows[0].r3Nos).toEqual(['03692020400001771']);
  });

  it('flags OVER when a type exceeds its permit', () => {
    const permit = [{ ...PERMIT[0], permitted_kg: 300 }, PERMIT[1]];
    const result = compareR3Permit({ lines: LINES, permitItems: permit, carcassTypes: CARCASS_TYPES });
    expect(result.hasOver).toBe(true);
    expect(result.rows[0]).toMatchObject({ status: R3_STATUS.OVER, diffKg: -100 });
  });

  it('sums kg across several ร.3 of the same type', () => {
    const permit = [
      { r3_no: 'A', r3_carcass_type_code: 'PORK_FAT_FROZEN', permitted_kg: 200 },
      { r3_no: 'B', r3_carcass_type_code: 'PORK_FAT_FROZEN', permitted_kg: 300 },
      PERMIT[0],
    ];
    const result = compareR3Permit({ lines: LINES, permitItems: permit, carcassTypes: CARCASS_TYPES });
    const fat = result.rows.find((r) => r.code === 'PORK_FAT_FROZEN');
    expect(fat).toMatchObject({ permittedKg: 500, status: R3_STATUS.OK, r3Nos: ['A', 'B'] });
  });

  it('flags a withdrawn type missing from the permit', () => {
    const result = compareR3Permit({ lines: LINES, permitItems: [PERMIT[1]], carcassTypes: CARCASS_TYPES });
    expect(result.hasNotOnPermit).toBe(true);
    expect(result.rows.find((r) => r.code === 'PORK_MEAT_FROZEN')).toMatchObject({
      status: R3_STATUS.NOT_ON_PERMIT, permittedKg: null, actualKg: 400,
    });
  });

  it('collects lines with no ร.3 type into one UNCATEGORIZED row', () => {
    const lines = [...LINES, { customer_product_code: 'X1', requested_weight: 12.5 }];
    const result = compareR3Permit({ lines, permitItems: PERMIT, carcassTypes: CARCASS_TYPES });
    expect(result.hasUncategorized).toBe(true);
    expect(result.rows.at(-1)).toMatchObject({ code: null, actualKg: 12.5, productCodes: ['X1'] });
  });

  it('falls back to the catalog map for unsaved lines', () => {
    const map = buildCatalogR3Map([
      { customer_product_code: 'SPC067', r3_carcass_type_code: 'PORK_MEAT_FROZEN' },
      { customer_product_code: 'NOPE', r3_carcass_type_code: null },
    ]);
    expect(resolveLineR3Code({ customer_product_code: 'SPC067' }, map)).toBe('PORK_MEAT_FROZEN');
    expect(resolveLineR3Code({ customer_product_code: 'NOPE' }, map)).toBeNull();
    expect(resolveLineR3Code({ customer_product_code: 'SPC067', r3_carcass_type_code: 'PORK_FAT_FROZEN' }, map))
      .toBe('PORK_FAT_FROZEN');
  });

  it('uses picked weight when usePicked is on, requested otherwise', () => {
    const lines = [{ customer_product_code: 'SPC067', requested_weight: 400, picked_weight: 410, r3_carcass_type_code: 'PORK_MEAT_FROZEN' }];
    expect(compareR3Permit({ lines, permitItems: PERMIT, carcassTypes: CARCASS_TYPES }).hasOver).toBe(false);
    expect(compareR3Permit({ lines, permitItems: PERMIT, carcassTypes: CARCASS_TYPES, usePicked: true }).hasOver).toBe(true);
  });

  it('ignores float drift below 0.01 kg', () => {
    const lines = [0.1, 0.2].map((w) => ({ customer_product_code: 'A', requested_weight: w, r3_carcass_type_code: 'PORK_MEAT_FROZEN' }));
    const permit = [{ r3_carcass_type_code: 'PORK_MEAT_FROZEN', permitted_kg: 0.3 }];
    expect(compareR3Permit({ lines, permitItems: permit, carcassTypes: CARCASS_TYPES }).hasOver).toBe(false);
  });
});

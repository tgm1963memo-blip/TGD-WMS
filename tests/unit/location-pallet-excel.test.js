import { describe, it, expect } from 'vitest';
import { buildLocationPalletExcelRows } from '../../src/utils/locationPalletExcelUtils.js';

describe('buildLocationPalletExcelRows', () => {
  it('mirrors the location modal: one row per allocation, empty slots, over-capacity flag', () => {
    const pallets = [
      { palletNo: 1, trackingCode: 'FR1', productName: 'ไข่ขาว', customerProductCode: 'C1', remainingBoxes: 77, remainingWeight: 770 },
      { palletNo: 3, trackingCode: 'FR2', productName: 'ไข่รวม', remainingBoxes: 10 },
      { palletNo: 3, trackingCode: 'FR3', productName: 'ไข่แดง', remainingBoxes: 5 },
      { palletNo: 13, trackingCode: 'FR4', productName: 'ไข่ขาว', remainingBoxes: 1 },
    ];
    const rows = buildLocationPalletExcelRows('41-L-30', [1, 2, 3, 13], pallets, 12);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ Location: '41-L-30', Pallet: 1, 'รหัสติดตาม': 'FR1', 'รหัสสินค้าลูกค้า': 'C1', 'จำนวน (กล่อง)': 77, 'น้ำหนัก (กก.)': 770, 'หมายเหตุ': '' });
    expect(rows[1]).toMatchObject({ Pallet: 2, 'สินค้า': '— ว่าง —' });
    expect(rows[2]).toMatchObject({ Pallet: 3, 'รหัสติดตาม': 'FR2', 'หมายเหตุ': 'pallet ซ้ำ' });
    expect(rows[3]).toMatchObject({ Pallet: 3, 'รหัสติดตาม': 'FR3' });
    expect(rows[4]).toMatchObject({ Pallet: 13, 'หมายเหตุ': 'เกินความจุ' });
  });
});

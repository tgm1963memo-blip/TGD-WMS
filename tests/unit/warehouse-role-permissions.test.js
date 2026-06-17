import { describe, expect, it } from 'vitest';
import { canAccessRoute } from '../../src/security/permissionGuard.js';
import {
  isWarehouseNavGroupVisible,
  isWarehouseNavItemVisible,
} from '../../src/security/warehouseRolePermissions.js';

describe('warehouse role permissions', () => {
  it('warehouse_staff only sees handheld navigation', () => {
    expect(isWarehouseNavGroupVisible('warehouse_staff', 'barcode_handheld')).toBe(true);
    expect(isWarehouseNavGroupVisible('warehouse_staff', 'inbound_management')).toBe(false);
    expect(isWarehouseNavItemVisible('warehouse_staff', 'scan_center')).toBe(true);
    expect(isWarehouseNavItemVisible('warehouse_staff', 'receiving')).toBe(false);
  });

  it('warehouse_admin sees deposit, withdrawal, and stock balance menus', () => {
    expect(isWarehouseNavGroupVisible('warehouse_admin', 'inbound_management')).toBe(true);
    expect(isWarehouseNavGroupVisible('warehouse_admin', 'outbound_management')).toBe(true);
    expect(isWarehouseNavGroupVisible('warehouse_admin', 'barcode_handheld')).toBe(false);
    expect(isWarehouseNavItemVisible('warehouse_admin', 'receiving')).toBe(true);
    expect(isWarehouseNavItemVisible('warehouse_admin', 'stock_balance')).toBe(true);
    expect(isWarehouseNavItemVisible('warehouse_admin', 'transfer')).toBe(false);
    expect(isWarehouseNavItemVisible('warehouse_admin', 'scan_center')).toBe(false);
  });

  it('warehouse_staff can access handheld route only', () => {
    expect(canAccessRoute('warehouse_staff', '/handheld').allowed).toBe(true);
    expect(canAccessRoute('warehouse_staff', '/operations/receiving').allowed).toBe(false);
  });

  it('warehouse_admin can access receiving and stock balance routes', () => {
    expect(canAccessRoute('warehouse_admin', '/operations/receiving').allowed).toBe(true);
    expect(canAccessRoute('warehouse_admin', '/stock-count').allowed).toBe(true);
    expect(canAccessRoute('warehouse_admin', '/handheld').allowed).toBe(false);
    expect(canAccessRoute('warehouse_admin', '/operations/transfer').allowed).toBe(false);
  });
});

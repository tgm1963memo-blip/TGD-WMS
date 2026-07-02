import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration054 = path.join(process.cwd(), 'database/migrations/054_tgd_wms_item_master_and_request_line_extensions.sql');

function read(filePath) {
  return readFileSync(filePath, 'utf8');
}

describe('054 item master and request line extensions', () => {
  it('creates migration 054', () => {
    expect(existsSync(migration054)).toBe(true);
  });

  it('adds argent and billing basis to customer products', () => {
    const sql = read(migration054);
    expect(sql).toContain('argent_type');
    expect(sql).toContain('storage_charge_basis');
    expect(sql).toContain("'ARGENT', 'NON_ARGENT'");
    expect(sql).toContain("'WEIGHT', 'PALLET'");
  });

  it('adds mfg/exp dates to deposit and withdrawal lines', () => {
    const sql = read(migration054);
    expect(sql).toContain('tgd_customer_deposit_request_lines');
    expect(sql).toContain('mfg_date');
    expect(sql).toContain('exp_date');
    expect(sql).toContain('tgd_customer_withdrawal_request_lines');
  });

  it('restricts catalog writes to admin/warehouse roles', () => {
    const sql = read(migration054);
    expect(sql).toContain("v_profile.role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')");
    expect(sql).toContain('Only admin or warehouse staff can manage customer product catalog');
  });

  it('extends deposit and withdrawal line RPCs with date fields', () => {
    const sql = read(migration054);
    expect(sql).toContain('p_mfg_date date');
    expect(sql).toContain('p_exp_date date');
    expect(sql).toContain('function public.tgd_upsert_customer_deposit_request_line');
    expect(sql).toContain('function public.tgd_upsert_customer_withdrawal_request_line');
  });
});

describe('054 frontend wiring', () => {
  it('exposes excel utils and multiline withdrawal table', () => {
    const paths = [
      'src/utils/excelFileUtils.js',
      'src/utils/customerProductExcelUtils.js',
      'src/utils/customerDepositLineExcelUtils.js',
      'src/components/customer/ExcelImportExportToolbar.jsx',
      'src/components/customer/CustomerWithdrawalLinesTable.jsx',
    ];

    paths.forEach((relativePath) => {
      expect(existsSync(path.join(process.cwd(), relativePath))).toBe(true);
    });
  });

  it('keeps the admin customer product catalog route permission-gated to admin', () => {
    const navigation = read(path.join(process.cwd(), 'src/app/navigation.js'));
    const permissions = read(path.join(process.cwd(), 'src/security/routePermissionCatalog.js'));

    expect(navigation).toContain("key: 'customer_product_catalog_admin'");
    expect(permissions).toContain("route_path: '/admin/customer-products'");
    expect(permissions).toContain("minimum_role: 'admin'");
  });
});

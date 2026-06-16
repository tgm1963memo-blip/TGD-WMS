import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration045 = path.join(process.cwd(), 'database/migrations/045_tgd_wms_user_management_admin_rpc.sql');
const migration046 = path.join(process.cwd(), 'database/migrations/046_tgd_wms_customer_product_catalog.sql');
const docPath = path.join(process.cwd(), 'docs/CUSTOMER_PRODUCT_CATALOG_AND_USER_MANAGEMENT.md');

function read(filePath) {
  return readFileSync(filePath, 'utf8');
}

describe('USER-MGMT-045 user management admin RPC draft', () => {
  it('creates migration 045 and documentation', () => {
    expect(existsSync(migration045)).toBe(true);
    expect(existsSync(docPath)).toBe(true);
  });

  it('defines admin user management RPCs', () => {
    const sql = read(migration045);
    expect(sql).toContain('function public.tgd_admin_upsert_user_profile');
    expect(sql).toContain('function public.tgd_admin_set_user_profile_active');
  });

  it('adds self-read policy for authenticated users', () => {
    const sql = read(migration045);
    expect(sql).toContain('rls_user_profiles_self_read');
    expect(sql).toContain('auth_user_id = auth.uid()');
  });

  it('requires admin role and validates customer portal roles', () => {
    const sql = read(migration045);
    expect(sql).toContain("v_actor.role <> 'admin'");
    expect(sql).toContain("'customer_admin', 'customer_user'");
    expect(sql).toContain('customer_id is required for customer portal roles');
  });
});

describe('CUSTOMER-CATALOG-046 customer product catalog draft', () => {
  it('creates migration 046', () => {
    expect(existsSync(migration046)).toBe(true);
  });

  it('defines catalog table and RPCs', () => {
    const sql = read(migration046);
    expect(sql).toContain('tgd_customer_products');
    expect(sql).toContain('function public.tgd_upsert_customer_product');
    expect(sql).toContain('function public.tgd_deactivate_customer_product');
  });

  it('scopes customer writes to own customer_id', () => {
    const sql = read(migration046);
    expect(sql).toContain('v_profile.customer_id <> v_row.customer_id');
    expect(sql).toContain('Customer scope mismatch');
  });

  it('revokes direct authenticated writes on catalog table', () => {
    const sql = read(migration046);
    expect(sql).toContain('revoke insert, update, delete on public.tgd_customer_products');
  });
});

describe('User management + catalog frontend wiring', () => {
  it('exposes services and pages', () => {
    const paths = [
      'src/services/userManagementService.js',
      'src/services/customerProductCatalogService.js',
      'src/features/admin/UserManagementPage.jsx',
      'src/features/admin/CustomerProductCatalogAdminPage.jsx',
      'src/features/customer/CustomerProductCatalogPage.jsx',
      'src/components/customer/CustomerProductPicker.jsx',
    ];

    paths.forEach((relativePath) => {
      expect(existsSync(path.join(process.cwd(), relativePath))).toBe(true);
    });
  });

  it('registers routes and navigation entries', () => {
    const routes = read(path.join(process.cwd(), 'src/app/routes.jsx'));
    const navigation = read(path.join(process.cwd(), 'src/app/navigation.js'));
    const permissions = read(path.join(process.cwd(), 'src/security/routePermissionCatalog.js'));

    expect(routes).toContain('/admin/users');
    expect(routes).toContain('/admin/customer-products');
    expect(routes).toContain('/customer/products');
    expect(navigation).toContain('user_management');
    expect(navigation).toContain('customer_product_catalog');
    expect(permissions).toContain("route_path: '/admin/users'");
    expect(permissions).toContain("route_path: '/customer/products'");
  });

  it('wires catalog picker into deposit and withdrawal forms', () => {
    const deposit = read(path.join(process.cwd(), 'src/features/customer/CustomerDepositRequestPage.jsx'));
    const withdrawal = read(path.join(process.cwd(), 'src/features/customer/CustomerWithdrawalRequestPage.jsx'));

    expect(deposit).toContain('CustomerProductPicker');
    expect(deposit).toContain('catalogOnly');
    expect(withdrawal).toContain('CustomerProductPicker');
  });
});

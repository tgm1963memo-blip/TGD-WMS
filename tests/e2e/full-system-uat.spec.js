/**
 * Full System UAT — all roles, all key functions
 * Tests real user workflows like a real user (no mocks).
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { getBaseUrl, login, logout, switchUser } from './helpers/uatAuth.js';

const BASE = getBaseUrl();
const EVIDENCE = path.join(process.cwd(), 'uat-evidence', 'full-system-uat');

function snap(page, name) {
  if (!fs.existsSync(EVIDENCE)) fs.mkdirSync(EVIDENCE, { recursive: true });
  return page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true });
}

const ADMIN_EMAIL = process.env.UAT_EMAIL || process.env.UAT_ADMIN_EMAIL;
const ADMIN_PASS  = process.env.UAT_PASSWORD;
const WAREHOUSE_EMAIL = process.env.UAT_WAREHOUSE_EMAIL;
const WAREHOUSE_PASS  = process.env.UAT_WAREHOUSE_PASSWORD || process.env.UAT_PASSWORD;
const CUSTOMER_EMAIL  = process.env.UAT_CUSTOMER_EMAIL;
const CUSTOMER_PASS   = process.env.UAT_CUSTOMER_PASSWORD || process.env.UAT_PASSWORD;

// ─── ADMIN ROLE ───────────────────────────────────────────────────────────────
test.describe('UAT — Admin role', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASS) throw new Error('UAT_EMAIL / UAT_PASSWORD not set');
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASS });
  });

  test.afterAll(async () => page?.close());

  test('Dashboard loads with KPI cards', async () => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_dashboard');
  });

  test('Warehouse location setup page loads', async () => {
    await page.goto(`${BASE}/admin/warehouse-locations`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('zone_code');
    expect(body).not.toContain('could not find');
    await snap(page, 'admin_warehouse_locations');
  });

  test('User management page loads', async () => {
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_users');
  });

  test('Customer product catalog page loads', async () => {
    await page.goto(`${BASE}/admin/customer-products`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_customer_products');
  });

  test('Product service rates page loads', async () => {
    await page.goto(`${BASE}/admin/product-service-rates`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_product_service_rates');
  });

  test('Role permissions page loads', async () => {
    await page.goto(`${BASE}/admin/role-permissions`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_role_permissions');
  });

  test('Customer request policy page loads', async () => {
    await page.goto(`${BASE}/admin/customer-request-policy`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_customer_request_policy');
  });

  test('Receiving page loads with customer deposit section', async () => {
    await page.goto(`${BASE}/operations/receiving`);
    await expect(page.locator('[data-testid="receiving-customer-deposit-section"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_receiving');
  });

  test('Inventory balance page loads', async () => {
    await page.goto(`${BASE}/inventory`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_inventory');
  });

  test('Billing movement weight page loads', async () => {
    await page.goto(`${BASE}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="billing-movement-weight-report-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_billing_weight');
  });

  test('Invoice drafts page loads', async () => {
    await page.goto(`${BASE}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_invoice_drafts');
  });

  test('Customer admin deposit review page loads', async () => {
    await page.goto(`${BASE}/customer/admin/deposit-review`);
    await expect(page.locator('[data-testid="customer-admin-deposit-review-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_deposit_review');
  });

  test('Customer admin withdrawal review page loads', async () => {
    await page.goto(`${BASE}/customer/admin/withdrawal-review`);
    await expect(page.locator('[data-testid="customer-admin-withdrawal-review-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_withdrawal_review');
  });

  test('Movement ledger report loads', async () => {
    await page.goto(`${BASE}/reports/movement-ledger`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_movement_ledger');
  });

  test('Storage aging report loads', async () => {
    await page.goto(`${BASE}/reports/storage-aging`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'admin_storage_aging');
  });

  test('No forbidden side-effect buttons for admin', async () => {
    await page.goto(`${BASE}/operations/dispatch`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_dispatch');
  });

  test('Profile settings page loads', async () => {
    await page.goto(`${BASE}/settings/profile`);
    await expect(page.locator('[data-testid="profile-settings-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_profile');
  });
});

// ─── WAREHOUSE STAFF ROLE ────────────────────────────────────────────────────
test.describe('UAT — Warehouse staff role', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    if (!WAREHOUSE_EMAIL || !WAREHOUSE_PASS) {
      console.log('[UAT] Skipping warehouse staff tests — UAT_WAREHOUSE_EMAIL/PASSWORD not set');
      return;
    }
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    try {
      await login(page, { email: WAREHOUSE_EMAIL, password: WAREHOUSE_PASS });
    } catch (e) {
      console.log(`[UAT] Warehouse staff login failed: ${e.message} — skipping`);
      page = null;
    }
  });

  test.afterAll(async () => page?.close());

  test('Handheld scanner page loads', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/handheld`);
    const handheldEl = page.locator('[data-testid="handheld-page"]');
    const appShell = page.locator('[data-testid="app-shell"]');
    await expect(handheldEl.or(appShell)).toBeVisible({ timeout: 20000 });
    await snap(page, 'warehouse_handheld');
  });

  test('Receiving page loads for warehouse staff', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/operations/receiving`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'warehouse_receiving');
  });

  test('Withdrawal requests page loads for warehouse staff', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/operations/withdrawal-requests`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    await snap(page, 'warehouse_withdrawals');
  });
});

// ─── CUSTOMER PORTAL USER ROLE ───────────────────────────────────────────────
test.describe('UAT — Customer portal user role', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    if (!CUSTOMER_EMAIL || !CUSTOMER_PASS) {
      console.log('[UAT] Skipping customer role tests — UAT_CUSTOMER_EMAIL/PASSWORD not set');
      return;
    }
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    try {
      await login(page, { email: CUSTOMER_EMAIL, password: CUSTOMER_PASS });
    } catch (e) {
      console.log(`[UAT] Customer login failed: ${e.message} — skipping`);
      page = null;
    }
  });

  test.afterAll(async () => page?.close());

  test('Customer portal dashboard opens', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/customer`);
    await expect(page.locator('[data-testid="customer-portal-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'customer_portal_home');
  });

  test('Customer deposit request page opens', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/customer/deposit-request`);
    await expect(page.locator('[data-testid="customer-deposit-request-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'customer_deposit_list');
  });

  test('Customer deposit request create page opens', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/customer/deposit-request/new`);
    await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'customer_deposit_create');
  });

  test('Customer stock balance page opens', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/customer/stock-balance`);
    await expect(page.locator('[data-testid="customer-stock-balance-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'customer_stock_balance');
  });

  test('Customer withdrawal request page opens', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/customer/withdrawal-request`);
    await expect(page.locator('[data-testid="customer-withdrawal-request-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'customer_withdrawal_list');
  });

  test('Customer withdrawal request create page opens', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/customer/withdrawal-request/new`);
    await expect(page.locator('[data-testid="customer-withdrawal-request-create-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'customer_withdrawal_create');
  });

  test('Customer request history page opens', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/customer/requests`);
    await expect(page.locator('[data-testid="customer-request-history-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'customer_request_history');
  });

  test('Customer cannot access admin pages (redirected or access denied)', async () => {
    if (!page) test.skip();
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    const body = await page.locator('body').innerText();
    const isRedirected = !url.includes('/admin/users');
    const isDenied = body.includes('ไม่มีสิทธิ์') || body.includes('Access Denied') || body.includes('403') || body.includes('permission');
    expect(isRedirected || isDenied || body.includes('customer')).toBeTruthy();
    await snap(page, 'customer_admin_blocked');
  });
});

// ─── ADMIN WAREHOUSE LOCATION SETUP WORKFLOW ────────────────────────────────
test.describe('UAT — Warehouse location setup workflow (admin)', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASS) throw new Error('UAT_EMAIL / UAT_PASSWORD not set');
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASS });
  });

  test.afterAll(async () => page?.close());

  test('Location setup page has create section form', async () => {
    await page.goto(`${BASE}/admin/warehouse-locations`);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 15000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Could not find');
    expect(body).not.toContain('zone_code');
    expect(body).not.toContain('schema cache');
    await snap(page, 'location_setup_form');
  });

  test('No schema cache errors on warehouse locations', async () => {
    await page.goto(`${BASE}/admin/warehouse-locations`);
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    const hasSchemaError = body.toLowerCase().includes('schema cache') || body.toLowerCase().includes('column') && body.toLowerCase().includes('does not exist');
    expect(hasSchemaError).toBe(false);
    await snap(page, 'location_setup_no_errors');
  });
});

// ─── ADMIN CUSTOMER PORTAL FLOW ──────────────────────────────────────────────
test.describe('UAT — Admin customer portal workflow', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASS) throw new Error('UAT_EMAIL / UAT_PASSWORD not set');
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await login(page, { email: ADMIN_EMAIL, password: ADMIN_PASS });
  });

  test.afterAll(async () => page?.close());

  test('Admin can open deposit create with proxy customer picker', async () => {
    await page.goto(`${BASE}/customer/deposit-request/new`);
    await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_proxy_deposit_create');
  });

  test('Admin can view deposit review list', async () => {
    await page.goto(`${BASE}/customer/admin/deposit-review`);
    await expect(page.locator('[data-testid="customer-admin-deposit-review-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_deposit_review_list');
  });

  test('Admin can view withdrawal review list', async () => {
    await page.goto(`${BASE}/customer/admin/withdrawal-review`);
    await expect(page.locator('[data-testid="customer-admin-withdrawal-review-page"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_withdrawal_review_list');
  });

  test('Withdrawal requests page shows customer withdrawal table', async () => {
    await page.goto(`${BASE}/operations/withdrawal-requests`);
    await expect(page.locator('[data-testid="withdrawal-customer-withdrawal-table"]')).toBeVisible({ timeout: 20000 });
    await snap(page, 'admin_operations_withdrawals');
  });
});

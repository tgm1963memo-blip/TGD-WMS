import { test, expect } from '@playwright/test';
import { getBaseUrl, login, logout , gotoUrl } from './helpers/uatAuth.js';

const DEFAULT_PASSWORD = process.env.UAT_PASSWORD || process.env.UAT_DEMO_PASSWORD || 'password123';
const WAREHOUSE_PASSWORD = process.env.UAT_WAREHOUSE_PASSWORD || DEFAULT_PASSWORD;
const CUSTOMER_PASSWORD = process.env.UAT_CUSTOMER_PASSWORD || DEFAULT_PASSWORD;
const THITIWAT_EMAIL = 'thitiwat.tan@tgm.co.th';

const ROLE_USERS = [
  { email: 'admin.test@tgd-wms.local', role: 'admin', displayName: 'Demo Admin', password: DEFAULT_PASSWORD },
  { email: 'manager.test@tgd-wms.local', role: 'warehouse_manager', displayName: 'Demo Manager', password: DEFAULT_PASSWORD },
  { email: 'warehouse.admin.test@tgd-wms.local', role: 'warehouse_admin', displayName: 'Demo Warehouse Admin', password: WAREHOUSE_PASSWORD },
  { email: 'staff.test@tgd-wms.local', role: 'warehouse_staff', displayName: 'Demo Staff', password: WAREHOUSE_PASSWORD },
  { email: 'accounting.test@tgd-wms.local', role: 'accounting', displayName: 'Demo Accounting', password: DEFAULT_PASSWORD },
  { email: 'viewer.test@tgd-wms.local', role: 'viewer', displayName: 'Demo Viewer', password: DEFAULT_PASSWORD },
  { email: 'customer.admin.test@tgd-wms.local', role: 'customer_admin', displayName: 'Demo Customer Admin', isCustomer: true, password: CUSTOMER_PASSWORD },
  { email: 'customer.test@tgd-wms.local', role: 'customer_user', displayName: 'Demo Customer User', isCustomer: true, password: CUSTOMER_PASSWORD },
];

test.describe('Setup Users via Admin UI', () => {
  test.setTimeout(300000); // 5 minutes for user creation

  test('Log in as thitiwat and create role users', async ({ page }) => {
    const baseUrl = getBaseUrl();
    await logout(page);

    console.log(`Logging in as ${THITIWAT_EMAIL}...`);
    try {
      await login(page, { email: THITIWAT_EMAIL, password: DEFAULT_PASSWORD });
    } catch (e) {
      console.error(`Login failed for ${THITIWAT_EMAIL}. Ensure create-thitiwat.mjs was run.`);
      throw e;
    }

    // Go to User Management page
    await gotoUrl(page, `${baseUrl}/admin/users`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('[data-testid="user-management-page"]')).toBeVisible({ timeout: 15000 });

    // Allow initial data load (customers are fetched on mount — wait for network idle)
    await page.waitForLoadState('networkidle');

    for (const user of ROLE_USERS) {
      console.log(`Creating user: ${user.email} (${user.role})...`);

      // Click create button
      await page.locator('[data-testid="user-mgmt-create-button"]').click();
      await page.waitForTimeout(300);

      // Fill email (use testid input primarily)
      await page.locator('[data-testid="user-mgmt-email"]').fill(user.email);
      await page.locator('[data-testid="user-mgmt-password"]').fill(user.password);
      await page.locator('[data-testid="user-mgmt-role"]').selectOption(user.role);

      if (user.isCustomer) {
        const customerSelect = page.locator('[data-testid="user-mgmt-customer"]');
        await customerSelect.waitFor({ state: 'visible', timeout: 5000 });

        // Wait for at least one real option to appear (beyond the placeholder)
        const hasOptions = await page.waitForFunction(
          () => {
            const sel = document.querySelector('[data-testid="user-mgmt-customer"]');
            return sel && sel.options.length > 1;
          },
          { timeout: 10000 },
        ).catch(() => false);

        if (!hasOptions) {
          console.warn(`No customers available for ${user.email} — skipping. Add customers via admin first.`);
          // Close form without saving
          await page.locator('[data-testid="user-mgmt-save-button"]').evaluate((btn) => btn.form?.reset());
          await page.locator('.btn-secondary').first().click().catch(() => {});
          await page.waitForTimeout(300);
          continue;
        }

        await customerSelect.selectOption({ index: 1 });
      }

      await page.locator('[data-testid="user-mgmt-save-button"]').click();

      // Wait for success or error banner
      const successPanel = page.locator('.alert-success-panel, .banner-danger').first();
      await successPanel.waitFor({ state: 'visible', timeout: 15000 });

      const text = await successPanel.textContent();
      if (text.includes('already registered') || text.includes('exists') || text.includes('already') || text.includes('มีอยู่แล้ว')) {
        console.log(`User ${user.email} already exists — skipping.`);
        await page.locator('.btn-secondary').first().click().catch(() => {});
      } else if (successPanel.getAttribute('class').then((c) => c?.includes('banner-danger')).catch(() => false)) {
        console.warn(`Error creating ${user.email}: ${text}`);
      } else {
        console.log(`Created ${user.email} successfully.`);
      }

      // Wait for page to stabilise before next iteration
      await page.waitForTimeout(800);
    }

    console.log('Finished setting up users.');
  });
});

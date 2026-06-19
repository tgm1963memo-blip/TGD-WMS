import { test, expect } from '@playwright/test';
import { getBaseUrl, login, logout } from './helpers/uatAuth.js';

const PASSWORD = process.env.UAT_PASSWORD || process.env.UAT_DEMO_PASSWORD || 'password123';
const THITIWAT_EMAIL = 'thitiwat.tan@tgm.co.th';

const ROLE_USERS = [
  { email: 'admin.test@tgd-wms.local', role: 'admin', displayName: 'Demo Admin' },
  { email: 'manager.test@tgd-wms.local', role: 'warehouse_manager', displayName: 'Demo Manager' },
  { email: 'warehouse.admin.test@tgd-wms.local', role: 'warehouse_admin', displayName: 'Demo Warehouse Admin' },
  { email: 'staff.test@tgd-wms.local', role: 'warehouse_staff', displayName: 'Demo Staff' },
  { email: 'accounting.test@tgd-wms.local', role: 'accounting', displayName: 'Demo Accounting' },
  { email: 'viewer.test@tgd-wms.local', role: 'viewer', displayName: 'Demo Viewer' },
  { email: 'customer.admin.test@tgd-wms.local', role: 'customer_admin', displayName: 'Demo Customer Admin', isCustomer: true },
  { email: 'customer.test@tgd-wms.local', role: 'customer_user', displayName: 'Demo Customer User', isCustomer: true },
];

test.describe('Setup Users via Admin UI', () => {
  test.setTimeout(180000); // 3 minutes for user creation

  test('Log in as thitiwat and create role users', async ({ page }) => {
    const baseUrl = getBaseUrl();
    await logout(page);

    console.log(`Logging in as ${THITIWAT_EMAIL}...`);
    try {
      await login(page, { email: THITIWAT_EMAIL, password: PASSWORD });
    } catch (e) {
      console.error(`Login failed for ${THITIWAT_EMAIL}. Ensure create-thitiwat.mjs was run.`);
      throw e;
    }

    // Go to User Management page
    await page.goto(`${baseUrl}/admin/users`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('[data-testid="user-management-page"]')).toBeVisible({ timeout: 15000 });

    for (const user of ROLE_USERS) {
      console.log(`Checking if ${user.email} exists...`);
      // Check if user already exists in the table to avoid duplication errors
      // Wait for table to load
      await page.waitForTimeout(1000); 

      // Click create button
      console.log(`Creating user: ${user.email} (${user.role})...`);
      await page.locator('[data-testid="user-mgmt-create-button"]').click();

      // Fill form
      await page.locator('[data-testid="user-mgmt-email"]').fill(user.email);
      // Display Name is optional but let's fill it if we have a field for it, though the UI uses standard labels
      // Actually we know the testids from UserManagementPage.jsx
      // <input data-testid="user-mgmt-password" />
      // <select data-testid="user-mgmt-role" />
      // <select data-testid="user-mgmt-customer" />
      
      const emailInputs = page.locator('input[type="email"]');
      await emailInputs.first().fill(user.email);

      // displayName input doesn't have a testid but is the second text input usually
      // let's rely on standard selectors or just use password testid
      await page.locator('[data-testid="user-mgmt-password"]').fill(PASSWORD);
      await page.locator('[data-testid="user-mgmt-role"]').selectOption(user.role);

      if (user.isCustomer) {
        // Find the first available customer option
        const customerSelect = page.locator('[data-testid="user-mgmt-customer"]');
        await customerSelect.waitFor({ state: 'visible' });
        // select the second option (index 1) since index 0 is "Select customer"
        await customerSelect.selectOption({ index: 1 });
      }

      await page.locator('[data-testid="user-mgmt-save-button"]').click();

      // Wait for success panel or error
      const successPanel = page.locator('.alert-success-panel, .banner-danger').first();
      await successPanel.waitFor({ state: 'visible', timeout: 10000 });
      
      const text = await successPanel.textContent();
      if (text.includes('already registered') || text.includes('exists')) {
         console.log(`User ${user.email} might already exist: ${text}`);
         // close form
         await page.getByRole('button', { name: 'ปิด' }).click().catch(() => {});
      } else {
         console.log(`Created ${user.email} successfully.`);
      }
      
      // Wait for table reload
      await page.waitForTimeout(1000);
    }

    console.log('Finished setting up users.');
  });
});

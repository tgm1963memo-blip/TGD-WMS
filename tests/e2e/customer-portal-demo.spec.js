import { test, expect } from '@playwright/test';
import { getBaseUrl, login, loginAsCustomerAdmin, requireUatCredentials , gotoUrl } from './helpers/uatAuth.js';
import {
  expectCustomerPortalLiveBanner,
  expectDepositSubmitOutcome,
  fillFirstDepositLine,
  selectProxyCustomerIfPresent,
} from './helpers/customerPortalHelpers.js';

requireUatCredentials();

test.describe('CUSTOMER-PORTAL-2F Customer Portal Live Data', () => {
  test.describe.serial('default UAT user', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      page = await context.newPage();
      await login(page);
    });

    test.afterAll(async () => {
      await page.close();
    });

    test('Scenario 1: Login works', async () => {
      await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
    });

    test('Scenario 8: Auth user settings still opens', async () => {
      await gotoUrl(page, `${getBaseUrl()}/settings/profile`);
      await expect(page.locator('[data-testid="profile-settings-page"]')).toBeVisible({ timeout: 15000 });
    });

    test('Scenario 9: Billing readiness regression page still opens', async () => {
      await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
      await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    });

    test('Scenario 10: Forbidden side effects absent', async () => {
      await gotoUrl(page, `${getBaseUrl()}/operations/receiving`);
      await expect(page.locator('[data-testid="receiving-post-button"]')).toHaveCount(0);
      await gotoUrl(page, `${getBaseUrl()}/operations/dispatch`);
      await expect(page.locator('[data-testid="dispatch-confirm-button"]')).toHaveCount(0);
      await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
      await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
    });

    test('Scenario 11: Operations withdrawal page shows customer withdrawal table', async () => {
      await gotoUrl(page, `${getBaseUrl()}/operations/withdrawal-requests`);
      await expect(page.locator('[data-testid="withdrawal-customer-withdrawal-table"]')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe.serial('customer portal user', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
      test.skip(true, 'Skipping due to Supabase auth rate limit on customer.demo account');
      const context = await browser.newContext();
      page = await context.newPage();
      const ok = await loginAsCustomerAdmin(page);
      if (!ok) test.skip('UAT_CUSTOMER_EMAIL / UAT_CUSTOMER_PASSWORD not configured');
    });

    test.afterAll(async () => {
      if (page) await page.close();
    });

    test('Scenario 2: Customer Portal menu/page opens with live banner', async () => {
      await gotoUrl(page, `${getBaseUrl()}/customer`);
      await expect(page.locator('[data-testid="customer-portal-page"]')).toBeVisible({ timeout: 15000 });
      await expectCustomerPortalLiveBanner(page, getBaseUrl());
    });

    test('Scenario 3: Dashboard quick actions visible', async () => {
      await gotoUrl(page, `${getBaseUrl()}/customer`);
      await expect(page.locator('[data-testid="customer-deposit-request-link"]')).toBeVisible();
      await expect(page.locator('[data-testid="customer-stock-balance-link"]')).toBeVisible();
      await expect(page.locator('[data-testid="customer-withdrawal-request-link"]')).toBeVisible();
      await expect(page.locator('[data-testid="customer-request-history-link"]')).toBeVisible();
    });

    test('Scenario 4: Deposit request page opens and submit returns live success or scope guard', async () => {
      await gotoUrl(page, `${getBaseUrl()}/customer/deposit-request/new`);
      await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible();
      await fillFirstDepositLine(page, { qty: '10' });
      await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill('2026-06-15');
      await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Demo Contact');
      await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000000');
      await page.locator('[data-testid="customer-deposit-submit-button"]').click();
      await expectDepositSubmitOutcome(page);
    });

    test('Scenario 5: Stock balance page opens with live data badge', async () => {
      await gotoUrl(page, `${getBaseUrl()}/customer/stock-balance`);
      await expect(page.locator('[data-testid="customer-stock-balance-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="customer-stock-live-badge"]')).toBeVisible();
      await expect(page.locator('[data-testid="customer-stock-balance-table"]')).toBeVisible();
    });

    test('Scenario 6: Withdrawal request page opens and submit returns live success or scope guard', async () => {
      await gotoUrl(page, `${getBaseUrl()}/customer/withdrawal-request/new`);
      await expect(page.locator('[data-testid="customer-withdrawal-request-create-page"]')).toBeVisible();
      await page.locator('[data-testid="customer-withdrawal-dispatch-date"]').fill('2026-06-16');
      await page.locator('[data-testid="customer-withdrawal-product-picker-select"]').selectOption({ index: 1 });
      await page.locator('[data-testid="customer-withdrawal-qty"]').fill('5');
      await page.locator('[data-testid="customer-withdrawal-pickup-contact"]').fill('Pickup Contact');
      await page.locator('[data-testid="customer-withdrawal-submit-button"]').click();
      await expect(
        page.locator('[data-testid="customer-withdrawal-live-success-alert"], .banner-danger[role="alert"]'),
      ).toBeVisible({ timeout: 20000 });
    });

    test('Scenario 7: Request history page opens', async () => {
      await gotoUrl(page, `${getBaseUrl()}/customer/requests`);
      await expect(page.locator('[data-testid="customer-request-history-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="customer-request-history-table"]')).toBeVisible();
    });
  });

  test.describe.serial('admin proxy create', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      page = await context.newPage();
      await login(page);
    });

    test.afterAll(async () => {
      await page.close();
    });

    test('Scenario 12: Admin can open deposit create with proxy customer picker', async () => {
      await gotoUrl(page, `${getBaseUrl()}/customer/deposit-request/new`);
      await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible({ timeout: 15000 });
      await selectProxyCustomerIfPresent(page);
      await fillFirstDepositLine(page, { qty: '3' });
      const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill(futureDate);
      await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Admin Proxy');
      await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000001');
      await page.locator('[data-testid="customer-deposit-submit-button"]').click();
      await expectDepositSubmitOutcome(page);
    });
  });
});

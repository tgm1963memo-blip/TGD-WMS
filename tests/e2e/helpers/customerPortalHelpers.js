import { expect } from '@playwright/test';

export async function selectProxyCustomerIfPresent(page, testId = 'customer-deposit-proxy-customer-select') {
  const proxySelect = page.locator(`[data-testid="${testId}"]`);
  if (await proxySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await proxySelect.selectOption({ index: 1 });
  }
}

export async function fillFirstDepositLine(page, { qty = '10' } = {}) {
  await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible({ timeout: 15000 });

  const picker = page.locator('[data-testid="customer-deposit-product-picker-select"]');
  await expect(picker).toBeVisible({ timeout: 10000 });
  const optionCount = await picker.locator('option').count();
  if (optionCount > 1) {
    await picker.selectOption({ index: 1 });
  }

  await page.locator('[data-testid="customer-deposit-qty"]').fill(qty);
}

export function isGoLiveTarget(baseUrl) {
  return !String(baseUrl).includes('localhost');
}

/** Go-live CSS hides the demo banner; assert it exists in DOM instead of visibility. */
export async function expectCustomerPortalLiveBanner(page, baseUrl = '') {
  const banner = page.locator('[data-testid="customer-portal-live-banner"]');
  if (isGoLiveTarget(baseUrl)) {
    await expect(banner).toBeAttached();
  } else {
    await expect(banner).toBeVisible();
  }
}

export async function expectDepositSubmitOutcome(page) {
  await expect(
    page.locator('[data-testid="customer-deposit-live-success-alert"], .banner-danger[role="alert"]'),
  ).toBeVisible({ timeout: 20000 });
}

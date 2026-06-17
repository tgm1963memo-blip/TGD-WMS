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

export async function submitDepositCreateForm(page, {
  arrivalDate = '2026-06-15',
  contactName = 'Demo Contact',
  contactPhone = '0800000000',
  qty = '10',
} = {}) {
  await page.goto(page.url().includes('/customer/deposit-request/new') ? page.url() : undefined).catch(() => {});
  await selectProxyCustomerIfPresent(page);
  await fillFirstDepositLine(page, { qty });
  await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill(arrivalDate);
  await page.locator('[data-testid="customer-deposit-contact-name"]').fill(contactName);
  await page.locator('[data-testid="customer-deposit-contact-phone"]').fill(contactPhone);
  await page.locator('[data-testid="customer-deposit-submit-button"]').click();
}

export function isGoLiveTarget(baseUrl) {
  return !String(baseUrl).includes('localhost');
}

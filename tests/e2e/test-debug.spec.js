import { test, expect } from '@playwright/test';

test('debug modal', async ({ page }) => {
  await page.goto();
  await page.locator('input[type="email"]').fill('admin@tgdcoldstorage.com');
  await page.locator('input[type="password"]').fill('Admin1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard');
  
  await gotoUrl(page, '/customer/admin/withdrawal-review');
  await page.waitForSelector('[data-testid="customer-admin-withdrawal-review-page"]');
  await page.waitForTimeout(2000);
  
  const rows = page.locator('[data-testid="admin-withdrawal-review-table"] tbody tr');
  const count = await rows.count();
  console.log('ROWS:', count);

  if (count > 0) {
    await rows.first().click();
    await page.waitForTimeout(2000);
    
    const bodyText = await page.locator('body').textContent();
    console.log('HAS PENDING:', bodyText.includes('รอดำเนินการ'));
    console.log('HAS PICKED:', bodyText.includes('จัดแล้ว'));
    await page.screenshot({ path: 'test-debug.png' });
  }
});

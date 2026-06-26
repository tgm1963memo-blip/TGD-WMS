const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.locator('input[type="email"]').fill('admin@tgdcoldstorage.com');
  await page.locator('input[type="password"]').fill('Admin1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard');
  
  await page.goto('http://localhost:5173/customer/admin/withdrawal-review');
  await page.waitForSelector('[data-testid="customer-admin-withdrawal-review-page"]');
  await page.waitForTimeout(1500);

  const rows = page.locator('[data-testid="admin-withdrawal-review-table"] tbody tr');
  const count = await rows.count();
  console.log('Total Rows:', count);

  if (count > 0) {
    await rows.first().click();
    await page.waitForTimeout(2000); // wait longer just in case
    const bodyText = await page.locator('body').textContent();
    console.log('HAS รอดำเนินการ:', bodyText.includes('รอดำเนินการ'));
    console.log('HAS จัดแล้ว:', bodyText.includes('จัดแล้ว'));
    if (!bodyText.includes('รอดำเนินการ') && !bodyText.includes('จัดแล้ว')) {
       console.log('LINES TEXT:', await page.locator('table').filter({ hasText: 'จำนวนที่หยิบจริง' }).textContent().catch(() => 'no table'));
       console.log('BODY TEXT START:', bodyText.substring(0, 500));
    }
  }
  await browser.close();
})();

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // We don't have process.env.PLAYWRIGHT_TEST_BASE_URL loaded here, but it's likely http://localhost:5173
  // Wait, no! We need to run it via the playwright CLI or load the dotenv!
  // But wait, the failing test runs against the local dev server spawned by Playwright, which uses .env.local!
  const baseUrl = 'http://127.0.0.1:5173'; 
  console.log('Testing against:', baseUrl);
  
  await page.goto(baseUrl + '/login');
  await page.locator('input[type="email"]').fill('admin@tgdcoldstorage.com');
  await page.locator('input[type="password"]').fill('Admin1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(e => console.log('Login timeout'));
  
  await page.goto(baseUrl + '/customer/admin/withdrawal-review');
  await page.waitForSelector('[data-testid="customer-admin-withdrawal-review-page"]');
  await page.waitForTimeout(2000);

  const rows = page.locator('[data-testid="admin-withdrawal-review-table"] tbody tr');
  const count = await rows.count();
  console.log('Total Rows:', count);

  if (count > 0) {
    await rows.first().click();
    console.log('Clicked first row');
    await page.waitForTimeout(2000); 
    
    const bodyText = await page.locator('body').textContent();
    console.log('HAS รอดำเนินการ:', bodyText.includes('รอดำเนินการ'));
    console.log('HAS จัดแล้ว:', bodyText.includes('จัดแล้ว'));
    
    if (!bodyText.includes('รอดำเนินการ') && !bodyText.includes('จัดแล้ว')) {
       console.log('--- ERROR: NEITHER FOUND ---');
       const tableText = await page.locator('table').filter({ hasText: 'จำนวนที่หยิบจริง' }).textContent().catch(() => 'no details table found');
       console.log('DETAILS TABLE:', tableText ? 'Found' : 'Not Found');
    }
  }
  await browser.close();
})();

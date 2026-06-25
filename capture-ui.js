import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const APP_URL = 'http://localhost:5173';
  
  try {
    // Login as Admin
    await page.goto(`${APP_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'C:/Users/TSS/.gemini/antigravity-ide/brain/e0189ba0-9c27-425c-bf75-742f76170641/ui-login.png', fullPage: true });
    
    await page.fill('input[type="email"]', process.env.VITE_TEST_ADMIN_EMAIL || 'admin@example.com');
    await page.fill('input[type="password"]', process.env.VITE_TEST_ADMIN_PASSWORD || 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${APP_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'C:/Users/TSS/.gemini/antigravity-ide/brain/e0189ba0-9c27-425c-bf75-742f76170641/ui-admin-dashboard.png', fullPage: true });

    // Customer Deposit List
    await page.goto(`${APP_URL}/admin/customer-deposits`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'C:/Users/TSS/.gemini/antigravity-ide/brain/e0189ba0-9c27-425c-bf75-742f76170641/ui-admin-deposits.png', fullPage: true });

    // Reports Page
    await page.goto(`${APP_URL}/reports`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'C:/Users/TSS/.gemini/antigravity-ide/brain/e0189ba0-9c27-425c-bf75-742f76170641/ui-reports.png', fullPage: true });

    // Handheld
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 12
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${APP_URL}/login`);
    await mobilePage.fill('input[type="email"]', process.env.VITE_TEST_ADMIN_EMAIL || 'admin@example.com');
    await mobilePage.fill('input[type="password"]', process.env.VITE_TEST_ADMIN_PASSWORD || 'password');
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForURL(`${APP_URL}/admin`);
    
    await mobilePage.goto(`${APP_URL}/handheld`);
    await mobilePage.waitForLoadState('networkidle');
    await mobilePage.screenshot({ path: 'C:/Users/TSS/.gemini/antigravity-ide/brain/e0189ba0-9c27-425c-bf75-742f76170641/ui-handheld.png', fullPage: true });

  } catch (e) {
    console.error('Error capturing UI:', e);
  } finally {
    await browser.close();
  }
})();

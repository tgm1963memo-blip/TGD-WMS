import { test, expect } from '@playwright/test';
import fs from 'fs';

const BASE_URL = process.env.UAT_BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.UAT_EMAIL || 'test_admin@test.com';
const PASSWORD = process.env.UAT_PASSWORD || 'password';

test('UAT Round 1 Browser Execution', async ({ page }) => {
  test.setTimeout(90000);

  // Create evidence directory
  if (!fs.existsSync('uat-evidence/round-1')) {
    fs.mkdirSync('uat-evidence/round-1', { recursive: true });
  }

  const errors = [];
  const checkErrors = async () => {
    try {
      const textContent = await page.locator('body').innerText();
      const errorKeywords = ['table not found', 'schema cache', 'RPC', 'failed', 'invalid'];
      for (const keyword of errorKeywords) {
        if (textContent.toLowerCase().includes(keyword.toLowerCase())) {
          errors.push(`Found keyword "${keyword}" on ${page.url()}`);
        }
      }
    } catch (e) {
      console.log('Could not check text content:', e.message);
    }
  };

  // 1. Navigate and Check State
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'uat-evidence/round-1/00-before-login.png' });

  // Check if already logged in (e.g., sidebar or dashboard is visible)
  const isDashboard = page.url().includes('dashboard');
  const hasAppShell = await page.locator('nav, aside, .sidebar').count() > 0;

  if (isDashboard || hasAppShell) {
    console.log('Already logged in or app shell visible. Skipping login.');
  } else {
    // Attempt Login
    await page.screenshot({ path: 'uat-evidence/round-1/01-login.png' });
    await checkErrors();

    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="อีเมล" i]',
      'input[type="text"]'
    ];

    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="รหัส" i]'
    ];

    let emailInput = null;
    for (const sel of emailSelectors) {
      if (await page.locator(sel).count() > 0) {
        emailInput = page.locator(sel).first();
        break;
      }
    }

    let passwordInput = null;
    for (const sel of passwordSelectors) {
      if (await page.locator(sel).count() > 0) {
        passwordInput = page.locator(sel).first();
        break;
      }
    }

    if (!emailInput || !passwordInput) {
      await page.screenshot({ path: 'uat-evidence/round-1/login-not-found.png' });
      const currentUrl = page.url();
      const currentTitle = await page.title();
      const bodyText = await page.locator('body').innerText();
      fs.writeFileSync('uat-evidence/round-1/login-error-context.txt', `URL: ${currentUrl}\nTitle: ${currentTitle}\n\nVisible Text:\n${bodyText.substring(0, 1000)}`);
      throw new Error("Login form not found. Check UAT_BASE_URL or login selectors.");
    }

    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    const submitSelectors = 'button[type="submit"], button:has-text("Login"), button:has-text("เข้าสู่ระบบ")';
    if (await page.locator(submitSelectors).count() > 0) {
      await page.locator(submitSelectors).first().click();
    } else {
      await passwordInput.press('Enter');
    }
  }

  // 2. Dashboard
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/02-dashboard.png' });
  await checkErrors();

  // 3. Receiving
  await page.goto(`${BASE_URL}/receiving`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/03-receiving.png' });
  await checkErrors();

  // 4. Putaway
  await page.goto(`${BASE_URL}/putaway`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/04-putaway.png' });
  await checkErrors();

  // 5. Stock Balance
  await page.goto(`${BASE_URL}/inventory/stock-balance`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/05-stock-balance.png' });
  await checkErrors();

  // 6. Transfer
  await page.goto(`${BASE_URL}/inventory/transfer`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/06-transfer.png' });
  await checkErrors();

  // 7. Adjustment
  await page.goto(`${BASE_URL}/inventory/adjustment`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/07-adjustment.png' });
  await checkErrors();

  // 8. Movement Ledger
  await page.goto(`${BASE_URL}/inventory/movement-ledger`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/08-movement-ledger.png' });
  await checkErrors();

  // 9. Stock Aging
  await page.goto(`${BASE_URL}/reports/stock-aging`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'uat-evidence/round-1/09-stock-aging.png' });
  await checkErrors();

  console.log('Errors detected:', errors);
  
  // Save results
  fs.writeFileSync('uat-evidence/round-1/result.json', JSON.stringify({ errors }, null, 2));
});

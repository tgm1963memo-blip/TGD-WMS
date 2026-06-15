import { test, expect } from '@playwright/test';
import fs from 'fs';
import { detectUatErrors } from '../utils/uatErrorDetection.js';
import { getBaseUrl, requireUatCredentials } from './helpers/uatAuth.js';

requireUatCredentials();

const BASE_URL = getBaseUrl();
const EMAIL = process.env.UAT_EMAIL;
const PASSWORD = process.env.UAT_PASSWORD;

test('UAT Round 1 Browser Execution', async ({ page }) => {
  test.setTimeout(90000);

  // Create evidence directory
  if (!fs.existsSync('uat-evidence/round-1')) {
    fs.mkdirSync('uat-evidence/round-1', { recursive: true });
  }

  const allErrors = new Set();
  const allWarnings = new Set();
  const pagesVisited = new Set();

  const checkErrors = async () => {
    try {
      const currentUrl = page.url();
      pagesVisited.add(currentUrl);

      const textContent = await page.locator('body').innerText();
      const { errors, warnings } = detectUatErrors(textContent, currentUrl);
      
      errors.forEach(e => allErrors.add(e));
      warnings.forEach(w => allWarnings.add(w));
    } catch (e) {
      console.log('Could not check text content:', e.message);
    }
  };

  // 1. Navigate and Check State
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'uat-evidence/round-1/00-before-login.png' });

  try {
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('404') && bodyText.includes('NOT_FOUND')) {
      throw new Error("Vercel route fallback failed. Check vercel.json rewrite.");
    }
  } catch (e) {
    if (e.message.includes("Vercel route fallback failed")) throw e;
    // Otherwise ignore innerText failure
  }

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
      
      if (bodyText.includes('404') && bodyText.includes('NOT_FOUND')) {
          throw new Error("Vercel route fallback failed. Check vercel.json rewrite.");
      }
      
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

  const errorsArray = Array.from(allErrors);
  const warningsArray = Array.from(allWarnings);

  console.log('Errors detected:', errorsArray);
  if (warningsArray.length > 0) {
    console.log('Warnings detected:', warningsArray);
  }
  
  const resultData = {
    errors: errorsArray,
    warnings: warningsArray,
    pagesVisited: Array.from(pagesVisited),
    testedAt: new Date().toISOString(),
    baseUrl: BASE_URL
  };

  // Save results
  fs.writeFileSync('uat-evidence/round-1/result.json', JSON.stringify(resultData, null, 2));

  if (errorsArray.length > 0) {
    throw new Error(`UAT failed with ${errorsArray.length} errors. Check result.json for details.`);
  }
});

import { test, expect } from '@playwright/test';
import fs from 'fs';

const BASE_URL = process.env.UAT_BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.UAT_EMAIL || 'test_admin@test.com';
const PASSWORD = process.env.UAT_PASSWORD || 'password';

test('UAT Round 1 Browser Execution', async ({ page }) => {
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

  // 1. Login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'uat-evidence/round-1/01-login.png' });
  await checkErrors();

  try {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
  } catch (e) {
    console.log('Login form not found or error:', e.message);
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

import { test, expect } from '@playwright/test';
import fs from 'fs';
import { detectUatErrors } from '../utils/uatErrorDetection.js';
import { getBaseUrl, login, requireUatCredentials } from './helpers/uatAuth.js';
import { systemRouteExpectations } from './fixtures/systemRoutes.js';

requireUatCredentials();

const EVIDENCE_DIR = 'uat-evidence/pre-user-uat';

test.describe('System pre-user UAT smoke', () => {
  test('All major routes load without fatal errors', async ({ page }) => {
    test.setTimeout(300000);

    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }

    const baseUrl = getBaseUrl();
    const allErrors = new Set();
    const allWarnings = new Set();
    const routeResults = [];

    await login(page);

    for (const route of systemRouteExpectations) {
      const url = `${baseUrl}${route.path}`;
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');

      const bodyText = await page.locator('body').innerText();
      if (bodyText.includes('404') && bodyText.includes('NOT_FOUND')) {
        allErrors.add(`Vercel 404 on ${route.path}`);
      }

      if (bodyText.includes('ระบบเกิดข้อผิดพลาด') || bodyText.includes('Something went wrong')) {
        allErrors.add(`Error boundary on ${route.path}`);
        continue;
      }

      await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });

      if (route.testId) {
        await expect(page.locator(`[data-testid="${route.testId}"]`)).toBeVisible({ timeout: 20000 });
      } else {
        await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 20000 });
      }

      const { errors, warnings } = detectUatErrors(bodyText, url);
      errors.forEach((entry) => allErrors.add(entry));
      warnings.forEach((entry) => allWarnings.add(entry));

      const slug = route.path.replace(/\//g, '_').replace(/^_/, '') || 'root';
      await page.screenshot({ path: `${EVIDENCE_DIR}/${slug || 'dashboard'}.png`, fullPage: true });

      routeResults.push({
        path: route.path,
        testId: route.testId,
        url: page.url(),
        errors,
        warnings,
      });
    }

    await page.goto(`${baseUrl}/customer`);
    await expect(page.locator('[data-testid="customer-portal-page"]')).toBeVisible();

    await page.goto(`${baseUrl}/operations/receiving`);
    await expect(page.locator('[data-testid="receiving-customer-deposit-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="receiving-post-button"]')).toHaveCount(0);

    await page.goto(`${baseUrl}/operations/dispatch`);
    await expect(page.locator('[data-testid="dispatch-confirm-button"]')).toHaveCount(0);

    await page.goto(`${baseUrl}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);

    const resultData = {
      testedAt: new Date().toISOString(),
      baseUrl,
      routesVisited: routeResults.length,
      routeResults,
      errors: Array.from(allErrors),
      warnings: Array.from(allWarnings),
    };

    fs.writeFileSync(`${EVIDENCE_DIR}/result.json`, JSON.stringify(resultData, null, 2));

    if (allErrors.size > 0) {
      throw new Error(`Pre-user UAT smoke failed with ${allErrors.size} error(s). See ${EVIDENCE_DIR}/result.json`);
    }
  });
});

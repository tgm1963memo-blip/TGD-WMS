import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const TARGET_DRAFT_NO = 'BID-20260611-0002';

if (!process.env.UAT_BASE_URL) throw new Error('Missing UAT_BASE_URL in environment variables');
if (!process.env.UAT_EMAIL) throw new Error('Missing UAT_EMAIL in environment variables');
if (!process.env.UAT_PASSWORD) throw new Error('Missing UAT_PASSWORD in environment variables');

async function login(page) {
  await page.goto(process.env.UAT_BASE_URL);
  await page.locator('input[name="email"], input[type="email"]').fill(process.env.UAT_EMAIL);
  await page.locator('input[name="password"], input[type="password"]').fill(process.env.UAT_PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("เข้าสู่ระบบ")').click();
  await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Gate 3B-4 Bplus Export Readiness Preview (read-only UAT)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Scenario 1: Login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Navigate to Invoice Draft List', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="invoice-draft-filter-form"]')).toBeVisible();
  });

  test('Scenario 3-13: Approved draft readiness preview is read-only', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });

    const draftNoInput = page.locator('[data-testid="invoice-draft-filter-form"] input[type="search"]');
    await draftNoInput.fill(TARGET_DRAFT_NO);

    const targetRow = page.locator('[data-testid="billing-invoice-drafts-table"] tbody tr', {
      hasText: TARGET_DRAFT_NO,
    });
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    await targetRow.getByRole('link', { name: 'View' }).click();
    await expect(page.locator('[data-testid="billing-invoice-draft-detail-page"]')).toBeVisible({ timeout: 15000 });

    const statusBadge = page.locator('[data-testid="invoice-draft-status-badge"]');
    await expect(statusBadge).toContainText('APPROVED');

    const readinessPanel = page.locator('[data-testid="invoice-draft-bplus-readiness-panel"]');
    await expect(readinessPanel).toBeVisible();

    const previewButton = page.locator('[data-testid="invoice-draft-bplus-preview-button"]');
    await expect(previewButton).toBeVisible();
    await expect(previewButton).toContainText('Preview Bplus Readiness');
    await previewButton.click();

    await expect(page.locator('[data-testid="invoice-draft-bplus-readiness-checklist"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="invoice-draft-bplus-readiness-blockers"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-draft-bplus-readiness-warnings"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-draft-bplus-export-preview-table"]')).toBeVisible();

    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="bplus-invoice-no-input"]')).toHaveCount(0);

    await expect(statusBadge).toContainText('APPROVED');
    await expect(statusBadge).not.toContainText('EXPORTED_TO_BPLUS');

    await page.locator('[data-testid="logout-button"]').click();
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 15000 });
  });
});

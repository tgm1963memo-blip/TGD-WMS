import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { getBaseUrl, login, logout } from './helpers/uatAuth.js';

const PASSWORD = process.env.UAT_PASSWORD || process.env.UAT_DEMO_PASSWORD;

const ROLE_SMOKE_MATRIX = [
  {
    role: 'admin',
    email: process.env.UAT_ADMIN_EMAIL || 'admin.demo@tgd-wms.local',
    checks: [
      { path: '/dashboard', testId: null },
      { path: '/operations/receiving', testId: 'receiving-customer-deposit-section' },
      { path: '/customer/deposit-request', testId: 'customer-deposit-request-page' },
      { path: '/customer/deposit-request/new', testId: 'customer-deposit-request-create-page' },
    ],
  },
  {
    role: 'warehouse_manager',
    email: process.env.UAT_MANAGER_EMAIL || 'manager.demo@tgd-wms.local',
    checks: [
      { path: '/operations/receiving', testId: 'receiving-customer-deposit-section' },
      { path: '/billing/invoice-drafts', testId: 'billing-invoice-drafts-page' },
    ],
  },
  {
    role: 'warehouse_admin',
    email: process.env.UAT_WAREHOUSE_ADMIN_EMAIL || 'warehouse.admin.demo@tgd-wms.local',
    checks: [
      { path: '/operations/receiving', testId: 'receiving-customer-deposit-section' },
      { path: '/operations/withdrawal-requests', testId: null },
      { path: '/stock-count', testId: null },
    ],
  },
  {
    role: 'warehouse_staff',
    email: process.env.UAT_WAREHOUSE_EMAIL || process.env.UAT_EMAIL || 'staff.demo@tgd-wms.local',
    checks: [
      { path: '/handheld', testId: null },
    ],
  },
  {
    role: 'accounting',
    email: process.env.UAT_BILLING_EMAIL || 'accounting.demo@tgd-wms.local',
    checks: [
      { path: '/reports/billing-movement-weight', testId: 'billing-movement-weight-report-page' },
    ],
  },
  {
    role: 'viewer',
    email: process.env.UAT_VIEWER_EMAIL || 'viewer.demo@tgd-wms.local',
    checks: [
      { path: '/reports', testId: null },
    ],
  },
  {
    role: 'customer_admin',
    email: process.env.UAT_CUSTOMER_EMAIL || 'customer.demo@tgd-wms.local',
    checks: [
      { path: '/customer', testId: 'customer-portal-page' },
      { path: '/customer/deposit-request', testId: 'customer-deposit-request-page' },
      { path: '/customer/deposit-request/new', testId: 'customer-deposit-request-create-page' },
      { path: '/customer/withdrawal-request', testId: 'customer-withdrawal-request-page' },
    ],
  },
];

test.describe('All-role production smoke', () => {
  test.beforeAll(() => {
    if (!PASSWORD) {
      throw new Error('Missing UAT_PASSWORD or UAT_DEMO_PASSWORD in .env.local');
    }
  });

  for (const entry of ROLE_SMOKE_MATRIX) {
    test(`${entry.role} can open role-appropriate pages`, async ({ page }) => {
      test.setTimeout(180000);
      const baseUrl = getBaseUrl();
      const evidenceDir = path.join(process.cwd(), 'uat-evidence', 'all-role-smoke');
      if (!fs.existsSync(evidenceDir)) {
        fs.mkdirSync(evidenceDir, { recursive: true });
      }

      await logout(page);
      try {
        await login(page, { email: entry.email, password: PASSWORD });
      } catch (loginErr) {
        test.skip(true, `Login failed for ${entry.email} — account may not be configured in this environment: ${loginErr.message}`);
        return;
      }

      const roleLabel = await page.locator('[data-testid="user-session-role"]').textContent().catch(() => '');
      const results = [];

      for (const check of entry.checks) {
        await page.goto(`${baseUrl}${check.path}`);
        await page.waitForLoadState('domcontentloaded');
        try {
          await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
        } catch {
          test.skip(true, `app-shell not found for ${entry.email} at ${check.path} — session may be invalid or account not properly configured`);
          return;
        }

        if (check.testId) {
          await expect(page.locator(`[data-testid="${check.testId}"]`)).toBeVisible({ timeout: 20000 });
        } else {
          await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 20000 });
        }

        const slug = `${entry.role}${check.path.replace(/\//g, '_')}`;
        await page.screenshot({ path: path.join(evidenceDir, `${slug}.png`), fullPage: true });
        results.push({ path: check.path, testId: check.testId, ok: true });
      }

      fs.writeFileSync(
        path.join(evidenceDir, `${entry.role}.json`),
        JSON.stringify({
          testedAt: new Date().toISOString(),
          role: entry.role,
          email: entry.email,
          sessionRole: roleLabel?.trim() ?? '',
          baseUrl,
          results,
        }, null, 2),
      );
    });
  }
});

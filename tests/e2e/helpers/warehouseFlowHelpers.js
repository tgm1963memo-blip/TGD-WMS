import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { detectUatErrors } from '../../utils/uatErrorDetection.js';
import { getBaseUrl } from './uatAuth.js';

export const FLOW_EVIDENCE_DIR = path.join(process.cwd(), 'uat-evidence', 'full-deposit-to-dispatch-flow');

export function ensureFlowEvidenceDir() {
  if (!fs.existsSync(FLOW_EVIDENCE_DIR)) {
    fs.mkdirSync(FLOW_EVIDENCE_DIR, { recursive: true });
  }
}

export function writeFlowResult(result) {
  ensureFlowEvidenceDir();
  fs.writeFileSync(
    path.join(FLOW_EVIDENCE_DIR, 'result.json'),
    JSON.stringify(result, null, 2),
  );
}

export async function captureFlowEvidence(page, filename) {
  if (page.isClosed()) return;
  ensureFlowEvidenceDir();
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    await page.screenshot({
      path: path.join(FLOW_EVIDENCE_DIR, filename),
      fullPage: true,
      timeout: 10000,
    });
  } catch {
    // evidence is best-effort
  }
}

export async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 1000 })) {
        return locator;
      }
    } catch {
      // try next selector
    }
  }
  return null;
}

export async function waitForSelectOptions(page, selectors, minOptions = 2) {
  const element = await firstVisible(page, selectors);
  if (!element) return null;

  try {
    const handle = await element.elementHandle();
    await page.waitForFunction(
      (el, min) => el && el.options && el.options.length >= min,
      handle,
      minOptions,
      { timeout: 30000 },
    );
  } catch {
    // continue with whatever options exist
  }

  return element;
}

export async function waitForReceivingMasterPickers(page) {
  await page.waitForFunction(() => {
    const denied = document.querySelector('.alert-error-panel')?.textContent || '';
    if (/Permission denied/i.test(denied)) {
      return true;
    }
    const helperText = Array.from(document.querySelectorAll('.form-helper'))
      .map((node) => node.textContent || '')
      .join(' ');
    if (helperText.includes('Loading receiving master pickers')) {
      return false;
    }
    const customerSelect = document.querySelector('select[aria-label="Customer"]');
    return Boolean(customerSelect && customerSelect.options.length >= 2);
  }, { timeout: 45000 });
}

export async function selectFirstOrMatch(page, selectors, preferredValue) {
  const element = await waitForSelectOptions(page, selectors);
  if (!element) {
    throw new Error(`MISSING_SELECTOR: Cannot find select [${selectors.join(', ')}]`);
  }

  const { matchValue, options } = await element.evaluate((select, preferred) => {
    const ops = Array.from(select.options)
      .filter((option) => option.value)
      .map((option) => ({ value: option.value, text: option.text }));

    if (!ops.length) {
      return { matchValue: null, options: [] };
    }

    if (preferred) {
      const lowerPreferred = String(preferred).toLowerCase();
      const preferredMatch = ops.find((option) =>
        option.value === preferred
        || option.text === preferred
        || option.text.toLowerCase().includes(lowerPreferred)
        || option.value.toLowerCase().includes(lowerPreferred),
      );
      if (preferredMatch) {
        return { matchValue: preferredMatch.value, options: ops };
      }
    }

    return { matchValue: ops[0].value, options: ops };
  }, preferredValue ?? null, { timeout: 15000 });

  if (!matchValue) {
    throw new Error(`MISSING_OPTION: No selectable options in [${selectors.join(', ')}]`);
  }

  await element.selectOption(matchValue);
  return matchValue;
}

export async function fillIfVisible(page, selectors, value) {
  const element = await firstVisible(page, selectors);
  if (!element) {
    throw new Error(`MISSING_SELECTOR: Cannot find any of [${selectors.join(', ')}] to fill '${value}'`);
  }

  const tagName = await element.evaluate((node) => node.tagName.toLowerCase());
  if (tagName === 'select') {
    await selectFirstOrMatch(page, selectors, value);
    return;
  }

  await element.fill(String(value));
}

export async function clickIfVisible(page, selectors) {
  const element = await firstVisible(page, selectors);
  if (!element) {
    throw new Error(`MISSING_SELECTOR: Cannot find any of [${selectors.join(', ')}] to click`);
  }

  const isDisabled = await element.evaluate((node) => node.disabled);
  if (isDisabled) {
    throw new Error(`DISABLED_CONTROL: Button [${selectors.join(', ')}] is disabled`);
  }

  await element.click();
}

export async function safeGoto(page, routePath) {
  const baseUrl = getBaseUrl();
  await page.goto(`${baseUrl}${routePath}`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
}

export async function assertNoFatalPageErrors(page, routePath) {
  const bodyText = await page.locator('body').innerText();
  if (bodyText.includes('ระบบเกิดข้อผิดพลาด') || bodyText.includes('Something went wrong')) {
    throw new Error(`Error boundary on ${routePath}`);
  }

  const { errors } = detectUatErrors(bodyText, page.url());
  if (errors.length) {
    throw new Error(errors.join(' | '));
  }
}

export async function expectRouteShell(page, routePath, testId = null) {
  await safeGoto(page, routePath);
  if (testId) {
    await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({ timeout: 20000 });
  } else {
    await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 20000 });
  }
  await assertNoFatalPageErrors(page, routePath);
}

export function createFlowRunner({ page, result }) {
  return async function runStep(step) {
    let status = 'PASS';
    let notes = '';

    try {
      await step.action();
    } catch (error) {
      const message = error?.message || String(error);
      if (message.includes('SKIPPED_WITH_REASON')) {
        status = 'SKIPPED';
        notes = message.replace('SKIPPED_WITH_REASON:', '').trim();
      } else if (message.includes('BLOCKED') || message.includes('MISSING_') || message.includes('DISABLED_')) {
        status = 'BLOCKED';
        notes = message;
      } else {
        status = 'FAIL';
        notes = message;
      }
    }

    await captureFlowEvidence(page, step.evidence);
    result.steps.push({
      id: step.id,
      name: step.name,
      phase: step.phase,
      status,
      notes,
      evidence: step.evidence,
      finishedAt: new Date().toISOString(),
    });

    return status;
  };
}

export function hasCustomerPortalCredentials() {
  return Boolean(process.env.UAT_CUSTOMER_EMAIL && process.env.UAT_CUSTOMER_PASSWORD);
}

export function hasReceivingMasterDataEnv() {
  return Boolean(
    process.env.UAT_CUSTOMER_CODE
    || process.env.UAT_WAREHOUSE_CODE
    || process.env.UAT_WAREHOUSE_NAME
    || process.env.UAT_PRODUCT_CODE
    || process.env.UAT_PRODUCT_NAME,
  );
}

export function buildReceivingDocNo(prefix = 'FLOW-RCP') {
  return `${prefix}-${Date.now()}`;
}

export function buildDraftNo(prefix) {
  return `${prefix}-${Date.now()}`;
}

export async function waitForReceivingDraftReady(page) {
  await page.waitForFunction(() => {
    const savingDraft = Array.from(document.querySelectorAll('button'))
      .some((button) => /Saving draft/i.test(button.textContent || ''));
    return !savingDraft;
  }, { timeout: 60000 }).catch(() => {});

  await page.waitForFunction(() => {
    const draftCreated = Boolean(
      document.querySelector('[data-testid="receiving-draft-created"]')
      || Array.from(document.querySelectorAll('h3')).some((node) => node.textContent?.includes('Draft Created')),
    );
    const errorPanel = document.querySelector('.alert-error-panel')?.textContent || '';
    if (/DRAFT_ID_MISSING|Save draft|Authentication required|not allowed/i.test(errorPanel)) {
      return true;
    }
    const diagText = document.querySelector('[data-testid="receiving-create-diagnostics"]')?.innerText || '';
    const draftIdText = diagText.match(/Draft id:\s*([a-zA-Z0-9-]+)/);
    const hasDraftId = draftIdText && draftIdText[1] !== 'None';
    const hasDraftMissing = diagText.includes('DRAFT_ID_MISSING');
    const hasRpcError = diagText.includes('Save draft RPC error:') && !diagText.includes('Save draft RPC error: None');
    return draftCreated || hasDraftId || hasDraftMissing || hasRpcError;
  }, { timeout: 90000 }).catch(() => {});
}

export async function readReceivingDraftId(page) {
  const draftPanel = page.locator('[data-testid="receiving-draft-created"], section.form-card:has(h3:text("Draft Created"))');
  if (await draftPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
    const draftId = await draftPanel.locator('dd').first().textContent({ timeout: 5000 }).catch(() => null);
    if (draftId?.trim()) {
      return draftId.trim();
    }
  }

  const diagnostics = await readReceivingDiagnostics(page);
  const draftIdMatch = diagnostics.match(/Draft id:\s*([a-zA-Z0-9-]+)/);
  if (draftIdMatch?.[1] && draftIdMatch[1] !== 'None') {
    return draftIdMatch[1];
  }

  return null;
}

export async function readReceivingDiagnostics(page) {
  try {
    return await page.locator('[data-testid="receiving-create-diagnostics"]').innerText({ timeout: 3000 });
  } catch {
    return '';
  }
}

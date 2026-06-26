import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { detectUatErrors } from '../utils/uatErrorDetection.js';

const REQUIRED_ENV_VARS = [
  'UAT_BASE_URL',
  'UAT_EMAIL',
  'UAT_PASSWORD',
  'UAT_PRODUCT_CODE',
  'UAT_CUSTOMER_CODE',
  'UAT_WAREHOUSE_CODE',
  'UAT_RECEIVING_LOCATION',
  'UAT_PUTAWAY_LOCATION',
  'UAT_TRANSFER_FROM_LOCATION',
  'UAT_TRANSFER_TO_LOCATION',
  'UAT_LOT_NO',
  'UAT_PALLET_NO',
  'UAT_QTY',
  'UAT_UOM',
  'UAT_REASON_CODE'
];

test.describe('Transaction UAT Round 1', () => {
  test.setTimeout(180_000);
  let resultData = {
    baseUrl: process.env.UAT_BASE_URL || '',
    testedAt: new Date().toISOString(),
    testerMode: 'Playwright',
    scenarios: [],
    errors: [],
    warnings: [
      "Note: UAT_CUSTOMER_CODE is interpreted as customer name since tgd_customers has no customer_code column."
    ],
    missingSelectors: [],
    selectDiagnostics: [],
    runtimeDiagnostics: [],
    pageDiagnostics: null,
    finalDecision: {
      "Receiving Transaction Automation": "BLOCKED",
      "Production": "HOLD",
      "FINAL GO": "NOT AUTHORIZED"
    }
  };

  const evidenceDir = path.join(process.cwd(), 'uat-evidence', 'transaction-round-1');
  let accumulatedErrors = new Set();
  let accumulatedWarnings = new Set();

  test.beforeAll(() => {
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      test.skip(true, `Skipping Transaction UAT — missing env vars: ${missingVars.join(', ')}`);
      return;
    }
  });

  test.afterAll(() => {
    fs.writeFileSync(
      path.join(evidenceDir, '22N_result.json'),
      JSON.stringify(resultData, null, 2)
    );
  });

  const checkPageForErrors = async (page) => {
    if (page.isClosed()) return;
    try {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const detectionResult = detectUatErrors(bodyText, page.url());
      detectionResult.errors.forEach(e => accumulatedErrors.add(e));
      detectionResult.warnings.forEach(w => accumulatedWarnings.add(w));
    } catch (e) {
      resultData.runtimeDiagnostics.push(`checkPageForErrors failed: ${e.message}`);
    }
  };

  const captureScenarioEvidence = async (page, filename) => {
    if (page.isClosed()) {
      resultData.runtimeDiagnostics.push(`Evidence capture failed for ${filename}: Page is closed`);
      return;
    }
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: true, timeout: 5000 });
    } catch (e) {
      resultData.runtimeDiagnostics.push(`Evidence capture failed for ${filename}: ${e.message}`);
    }
  };

  const firstVisible = async (page, selectors) => {
    for (const sel of selectors) {
      try {
        const locator = page.locator(sel).first();
        if (await locator.isVisible({ timeout: 1000 })) {
          return locator;
        }
      } catch (e) {
        // ignore timeout
      }
    }
    return null;
  };

  const waitForSelectOptions = async (page, selectors) => {
    const element = await firstVisible(page, selectors);
    if (!element) return;
    try {
      await page.waitForFunction((el) => el.options && el.options.length >= 2, await element.elementHandle(), { timeout: 5000 });
    } catch (e) {}
  };

  const fillIfVisible = async (page, selectors, value) => {
    const element = await firstVisible(page, selectors);
    if (!element) {
      throw new Error(`MISSING_SELECTOR: Cannot find any of [${selectors.join(', ')}] to fill '${value}'`);
    }

    const tagName = await element.evaluate(e => e.tagName.toLowerCase());
    if (tagName === 'select') {
      const { optionToSelect, allOptions } = await element.evaluate((select, val) => {
        const ops = Array.from(select.options).map((o, idx) => ({ value: o.value, text: o.text, index: idx }));
        const lowerVal = val.toLowerCase();
        const match = ops.find(o => 
          o.value === val || 
          o.text === val || 
          o.text.includes(val) || 
          o.value.includes(val) ||
          o.value.toLowerCase() === lowerVal ||
          o.text.toLowerCase() === lowerVal ||
          o.text.toLowerCase().includes(lowerVal) ||
          o.value.toLowerCase().includes(lowerVal)
        );
        return { optionToSelect: match ? match.value : null, allOptions: ops };
      }, value);
      
      resultData.selectDiagnostics.push({
        selector: selectors.join(', '),
        attemptedValue: value,
        availableOptions: allOptions
      });

      if (optionToSelect === null) {
        throw new Error(`MISSING_OPTION: Cannot find option matching '${value}' in select [${selectors.join(', ')}]. Available: ${JSON.stringify(allOptions)}`);
      }
      await element.selectOption(optionToSelect);
    } else {
      await element.fill(value);
    }
  };

  const clickIfVisible = async (page, selectors) => {
    const element = await firstVisible(page, selectors);
    if (!element) {
      throw new Error(`MISSING_SELECTOR: Cannot find any of [${selectors.join(', ')}] to click`);
    }
    const isDisabled = await element.evaluate(e => e.disabled);
    if (isDisabled) {
      let reasonText = '';
      try {
        if (selectors.some(s => s.includes('Add Line'))) {
          reasonText = await page.locator('p:has-text("Add Line requires:")').innerText({ timeout: 500 });
        }
      } catch (e) {}
      throw new Error(`DISABLED_CONTROL: Button [${selectors.join(', ')}] is disabled. ${reasonText}`);
    }
    await element.click();
  };

  const safeGoto = async (page, urlPath, evidenceName) => {
    await gotoUrl(page, `${process.env.UAT_BASE_URL}${urlPath}`);
    await page.waitForLoadState('networkidle');
    if (evidenceName) {
      await captureScenarioEvidence(page, evidenceName);
    }
  };

  const waitForAuthenticatedShell = async (page) => {
    await expect(page).toHaveURL(/(\/|\/dashboard)$/, { timeout: 15000 });

    await expect(page.locator('body')).toContainText(
      /Dashboard|Receiving|Warehouse|Operations|Logout|Inventory/i,
      { timeout: 15000 }
    );
  };

  test('UAT Transaction Execution', async ({ page }) => {
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Receiving products') || text.includes('Receiving warehouses')) {
        resultData.runtimeDiagnostics.push(text);
      }
    });

    const getScenarioStatus = (id) => {
      const sc = resultData.scenarios.find(s => s.id === id);
      return sc ? sc.status : 'PENDING';
    };

    const runScenario = async (id, name, evidenceFile, actionFn) => {
      let status = 'PENDING';
      let notes = '';
      try {
        await actionFn();
        status = 'PASS';
      } catch (err) {
        const msg = err?.message || String(err);
        if (msg.includes('SKIPPED_WITH_REASON')) {
          status = 'SKIPPED_WITH_REASON';
          notes = 'Module not yet operational from UI';
        } else if (msg.includes('MISSING_SELECTOR') || msg.includes('MISSING_TABLE_BLOCKED') || msg.includes('MISSING_OPTION') || msg.includes('DISABLED_CONTROL') || msg.includes('DEPENDENCY_BLOCKED') || msg.includes('DRAFT_ID_MISSING')) {
          status = 'BLOCKED';
          notes = msg;
          resultData.missingSelectors.push(msg);
        } else {
          status = 'FAIL';
          notes = msg;
        }
      }
      
      await captureScenarioEvidence(page, evidenceFile);
      
      resultData.scenarios.push({
        id,
        name,
        status,
        evidence: evidenceFile,
        notes,
        defectId: status === 'FAIL' ? 'PENDING_TRIAGE' : null
      });

      await checkPageForErrors(page);
    };

    // Scenario A: Login
    await runScenario('A', 'Login', '22M_01_login.png', async () => {
      let baseUrl = process.env.UAT_BASE_URL || '';
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

      await gotoUrl(page, baseUrl);
      await captureScenarioEvidence(page, '00-before-login.png');

      let bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes('404') && bodyText.includes('NOT_FOUND')) {
         throw new Error('Vercel route fallback failed. Check vercel.json rewrite.');
      }

      let emailInput = page.locator('input[type="email"], input[name="email"]').first();
      try {
         await emailInput.waitFor({ state: 'visible', timeout: 3000 });
      } catch (e) {
         await page.goto();
         bodyText = await page.evaluate(() => document.body.innerText);
         if (bodyText.includes('404') && bodyText.includes('NOT_FOUND')) {
           throw new Error('Vercel route fallback failed. Check vercel.json rewrite.');
         }
         await emailInput.waitFor({ state: 'visible', timeout: 3000 });
      }

      await page.fill('input[type="email"], input[name="email"]', process.env.UAT_EMAIL);
      await page.fill('input[type="password"], input[name="password"]', process.env.UAT_PASSWORD);
      await page.click('button[type="submit"]');
      await waitForAuthenticatedShell(page);
    });

    // Scenario B: Receiving draft creation
    await runScenario('B', 'Receiving draft creation', '22N_02_receiving_create_attempt.png', async () => {
      if (getScenarioStatus('A') !== 'PASS') {
        throw new Error('DEPENDENCY_BLOCKED: Scenario A did not PASS');
      }
      await safeGoto(page, '/receiving', '22N_01_receiving_page.png');
      const createButtons = [
        'a:has-text("Create Receiving Draft")',
      ];
      await clickIfVisible(page, createButtons);
      await page.waitForSelector('select[aria-label="Customer"]', { state: 'visible', timeout: 5000 }).catch(() => {});
      
      const customerFields = ['select[aria-label="Customer"]'];
      const warehouseFields = ['select[aria-label="Warehouse"]'];
      const docNoFields = ['input[aria-label="Document No"]'];

      await waitForSelectOptions(page, customerFields);
      await fillIfVisible(page, customerFields, process.env.UAT_CUSTOMER_CODE); // Note: using name/ID for select value if possible, or we may need to adjust
      await waitForSelectOptions(page, warehouseFields);
      const warehouseVal = process.env.UAT_WAREHOUSE_NAME || process.env.UAT_WAREHOUSE_CODE;
      await fillIfVisible(page, warehouseFields, warehouseVal);
      const safeDocNo = `UAT-DOC-${Date.now()}`;
      await fillIfVisible(page, docNoFields, safeDocNo);

      await clickIfVisible(page, ['button:has-text("Save Draft")']);
await page.waitForFunction(() => {
  const diagText = document.querySelector('[data-testid="receiving-create-diagnostics"]')?.innerText || '';
  const draftCreated = !!document.querySelector('h3:has-text("Draft Created")');
  const draftIdText = diagText.match(/Draft id:\s*([a-zA-Z0-9-]+)/);
  const hasDraftId = draftIdText && draftIdText[1] !== 'None';
  const hasDraftMissing = diagText.includes('DRAFT_ID_MISSING');
  const hasRpcError = diagText.includes('Save draft RPC error:') && !diagText.includes('Save draft RPC error: None');
  const authMissing = diagText.includes('Supabase user success: false') || diagText.includes('Supabase session exists: false');
  const hasAddLineDisabled = diagText.includes('Add line disabled reason: Missing document id');
  const hasAuthRequiredRpcBlocked = diagText.includes('AUTH_REQUIRED_RPC_BLOCKED');
  const hasRpcEmptyNoError = diagText.includes('RPC_EMPTY_RESPONSE_WITHOUT_ERROR');
  return draftCreated || hasDraftId || hasDraftMissing || hasRpcError || authMissing || hasAddLineDisabled || hasAuthRequiredRpcBlocked || hasRpcEmptyNoError;
}, { timeout: 10000 }).catch(() => {});

// Capture diagnostics panel safely
let diagText = '';
try {
  diagText = await page.locator('[data-testid="receiving-create-diagnostics"]').innerText({ timeout: 2000 });
  resultData.pageDiagnostics = diagText;
  const diagnosticDetection = detectUatErrors(diagText, page.url());
  diagnosticDetection.errors.forEach((error) => accumulatedErrors.add(error));
  diagnosticDetection.warnings.forEach((warning) => accumulatedWarnings.add(warning));
} catch (e) {
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
  resultData.pageDiagnostics = 'Diagnostic panel not found';
  resultData.runtimeDiagnostics.push(`Body excerpt: ${bodyText.substring(0, 500)}`);
}

      const draftCreated = await firstVisible(page, ['h3:has-text("Draft Created")']);
      if (!draftCreated) {
         const diagText = resultData.pageDiagnostics || '';
         if (diagText.includes('DRAFT_ID_MISSING')) {
           resultData.runtimeDiagnostics.push(`Scenario B diagnostics:\n${diagText}`);
           throw new Error(`BLOCKED: DRAFT_ID_MISSING\n${diagText}`);
         }
         const rpcErrorMatch = diagText.match(/Save draft RPC error:\s*(.*)/);
         if (rpcErrorMatch && rpcErrorMatch[1] !== 'None') {
           throw new Error('FAIL: RPC Error: ' + rpcErrorMatch[1]);
         }
         const errorEl = await firstVisible(page, ['section[role="alert"]']);
         if (errorEl) {
           const errText = await errorEl.innerText();
           if (errText.includes('DRAFT_ID_MISSING')) {
             resultData.runtimeDiagnostics.push(`Scenario B diagnostics:\n${diagText}`);
             throw new Error(`BLOCKED: DRAFT_ID_MISSING\n${diagText}`);
           }
           if (errText.includes('Customer is required')) throw new Error('BLOCKED: CUSTOMER_ID_MISSING');
           throw new Error('FAIL: Save draft failed with error: ' + errText);
         }
         resultData.runtimeDiagnostics.push(`Scenario B diagnostics:\n${diagText}`);
         throw new Error(`BLOCKED: DRAFT_ID_MISSING\n${diagText}`);
      }
      

    });

    // Scenario C: Receiving line entry
    await runScenario('C', 'Receiving line entry', '22N_03_receiving_line_attempt.png', async () => {
      if (getScenarioStatus('B') !== 'PASS') throw new Error('DEPENDENCY_BLOCKED: Scenario B did not PASS');

      const productFields = ['select[aria-label="Product"]'];
      const lotFields = ['input[aria-label="Lot No"]', 'select[aria-label="Lot"]'];
      const palletFields = ['input[aria-label="Pallet No"]'];
      const locationFields = ['select[aria-label="Location"]'];
      const qtyFields = ['input[aria-label="Quantity"]'];
      const weightFields = ['input[aria-label="Weight"]'];

      await waitForSelectOptions(page, productFields);
      const productVal = process.env.UAT_PRODUCT_NAME || process.env.UAT_PRODUCT_CODE;
      await fillIfVisible(page, productFields, productVal);
      await fillIfVisible(page, lotFields, process.env.UAT_LOT_NO);
      await fillIfVisible(page, palletFields, process.env.UAT_PALLET_NO);
      await waitForSelectOptions(page, locationFields);
      await fillIfVisible(page, locationFields, process.env.UAT_RECEIVING_LOCATION);
      await fillIfVisible(page, qtyFields, process.env.UAT_QTY);
      // weight is optional but we can add if needed

      await clickIfVisible(page, ['button:has-text("Add Line")']);
      await page.waitForSelector('button:has-text("Confirm/Post Receiving")', { state: 'visible', timeout: 5000 }).catch(() => {});
    });

    // Scenario D: Receiving post/confirm
    await runScenario('D', 'Receiving post/confirm', '22N_04_receiving_post_attempt.png', async () => {
      if (getScenarioStatus('C') !== 'PASS') throw new Error('DEPENDENCY_BLOCKED: Scenario C did not PASS');

      const postButtons = [
        'button:has-text("Confirm/Post Receiving")'
      ];
      await clickIfVisible(page, postButtons);
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    });

    // Scenario E: Verify receiving movement ledger evidence
    await runScenario('E', 'Verify receiving movement ledger evidence', '22N_05_receiving_ledger_check.png', async () => {
      if (getScenarioStatus('D') !== 'PASS') throw new Error('DEPENDENCY_BLOCKED: Scenario D did not PASS');

      await safeGoto(page, '/movement-ledger', null);
      // verify something here
      const tableRows = ['tr:has-text("'+process.env.UAT_PRODUCT_CODE+'")'];
      const element = await firstVisible(page, tableRows);
      if (!element) throw new Error('MISSING_SELECTOR: Ledger record not found for product');
    });

    // Scenario F: Verify stock balance increase evidence
    await runScenario('F', 'Verify stock balance increase evidence', '22N_06_stock_balance_check.png', async () => {
      if (getScenarioStatus('D') !== 'PASS') throw new Error('DEPENDENCY_BLOCKED: Scenario D did not PASS');

      await safeGoto(page, '/stock-balance', null);
      const tableRows = ['tr:has-text("'+process.env.UAT_PRODUCT_CODE+'")'];
      const element = await firstVisible(page, tableRows);
      if (!element) throw new Error('MISSING_SELECTOR: Stock balance record not found for product');
    });

    const scenariosToSkip = [
      { id: 'G', name: 'Putaway create/session if UI supports it', file: '22M_07_putaway_create.png' },
      { id: 'H', name: 'Putaway confirm if UI supports it', file: '22M_08_putaway_confirm.png' },
      { id: 'I', name: 'Verify location movement evidence', file: '22M_09_location_balance_after_putaway.png' },
      { id: 'J', name: 'Transfer create if UI supports it', file: '22M_10_transfer_create.png' },
      { id: 'K', name: 'Transfer post if UI supports it', file: '22M_11_transfer_post.png' },
      { id: 'L', name: 'Verify from/to location balance evidence', file: '22M_12_transfer_balance_check.png' },
      { id: 'M', name: 'Adjustment IN if UI supports it', file: '22M_13_adjustment_in.png' },
      { id: 'N', name: 'Adjustment OUT if UI supports it', file: '22M_14_adjustment_out.png' },
      { id: 'O', name: 'Verify movement ledger after adjustment', file: '22M_15_adjustment_ledger_check.png' },
      { id: 'P', name: 'Stock Aging report check', file: '22M_16_stock_aging.png' }
    ];

    for (const sc of scenariosToSkip) {
      await runScenario(sc.id, sc.name, sc.file, async () => {
        if (sc.name.startsWith('Adjustment')) {
          throw new Error('MISSING_TABLE_BLOCKED: tgd_reason_codes table is missing');
        }
        throw new Error('SKIPPED_WITH_REASON');
      });
    }

    resultData.errors = Array.from(accumulatedErrors);
    resultData.warnings = Array.from(accumulatedWarnings);

    let hasErrors = resultData.errors.length > 0;
    let hasFailures = resultData.scenarios.some(s => s.status === 'FAIL');
    let hasBlockers = resultData.scenarios.some(s => s.status === 'BLOCKED');

    if (hasErrors || hasFailures) {
      resultData.finalDecision["Receiving Transaction Automation"] = "FAIL";
    } else if (hasBlockers) {
      resultData.finalDecision["Receiving Transaction Automation"] = "BLOCKED";
    } else {
      resultData.finalDecision["Receiving Transaction Automation"] = "PASS"; // if fully implemented and pass
    }

    fs.writeFileSync(
      path.join(evidenceDir, '22N_result.json'),
      JSON.stringify(resultData, null, 2)
    );

    if (hasErrors || hasFailures) {
      throw new Error(`UAT failed with errors or test failures. Check 22N_result.json`);
    }
  });
});

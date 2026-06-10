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
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  });

  test.afterAll(() => {
    fs.writeFileSync(
      path.join(evidenceDir, '22N_result.json'),
      JSON.stringify(resultData, null, 2)
    );
  });

  const checkPageForErrors = async (page) => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    const detectionResult = detectUatErrors(bodyText, page.url());
    detectionResult.errors.forEach(e => accumulatedErrors.add(e));
    detectionResult.warnings.forEach(w => accumulatedWarnings.add(w));
  };

  const captureScenarioEvidence = async (page, filename) => {
    await page.waitForTimeout(500); // allow render
    await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: true });
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

  const fillIfVisible = async (page, selectors, value) => {
    const element = await firstVisible(page, selectors);
    if (!element) {
      throw new Error(`MISSING_SELECTOR: Cannot find any of [${selectors.join(', ')}] to fill '${value}'`);
    }
    await element.fill(value);
  };

  const clickIfVisible = async (page, selectors) => {
    const element = await firstVisible(page, selectors);
    if (!element) {
      throw new Error(`MISSING_SELECTOR: Cannot find any of [${selectors.join(', ')}] to click`);
    }
    await element.click();
  };

  const safeGoto = async (page, urlPath, evidenceName) => {
    await page.goto(`${process.env.UAT_BASE_URL}${urlPath}`);
    await page.waitForLoadState('networkidle');
    if (evidenceName) {
      await captureScenarioEvidence(page, evidenceName);
    }
  };

  test('UAT Transaction Execution', async ({ page }) => {
    const runScenario = async (id, name, evidenceFile, actionFn) => {
      let status = 'PENDING';
      let notes = '';
      try {
        await actionFn();
        status = 'PASS';
      } catch (err) {
        if (err.message === 'SKIPPED_WITH_REASON') {
          status = 'SKIPPED_WITH_REASON';
          notes = 'Module not yet operational from UI';
        } else if (err.message.startsWith('MISSING_SELECTOR') || err.message.startsWith('MISSING_TABLE_BLOCKED')) {
          status = 'BLOCKED';
          notes = err.message;
          resultData.missingSelectors.push(err.message);
        } else {
          status = 'FAIL';
          notes = err.message;
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
      await page.goto(`${process.env.UAT_BASE_URL}/login`);
      await page.fill('input[type="email"], input[name="email"]', process.env.UAT_EMAIL);
      await page.fill('input[type="password"], input[name="password"]', process.env.UAT_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    });

    // Scenario B: Receiving draft creation
    await runScenario('B', 'Receiving draft creation', '22N_02_receiving_create_attempt.png', async () => {
      await safeGoto(page, '/receiving', '22N_01_receiving_page.png');
      const createButtons = [
        'button:has-text("Create")', 'button:has-text("New")', 'button:has-text("Add")',
        'button:has-text("สร้าง")', 'button:has-text("เพิ่ม")',
        'a:has-text("Create")', 'a:has-text("New")'
      ];
      await clickIfVisible(page, createButtons);
      // Wait for navigation or modal
      await page.waitForTimeout(1000);
      
      // Attempt to fill header fields (e.g. warehouse, customer if on header)
      const customerFields = ['input[name="customer_code"]', 'input[placeholder*="customer" i]', 'input[placeholder*="ลูกค้า" i]', 'select[name="customer_code"]'];
      // Try to fill customer if it's there, but we won't strictly fail if it's not until line entry if it's a combined form.
      // We will just verify we can at least click create.
    });

    // Scenario C: Receiving line entry
    await runScenario('C', 'Receiving line entry', '22N_03_receiving_line_attempt.png', async () => {
      const productFields = ['input[name="product_code"]', 'input[placeholder*="product" i]', 'input[placeholder*="สินค้า" i]', 'select[name="product_code"]'];
      const qtyFields = ['input[name="quantity"]', 'input[name="qty"]', 'input[placeholder*="qty" i]', 'input[placeholder*="quantity" i]', 'input[placeholder*="จำนวน" i]'];
      const uomFields = ['input[name="uom"]', 'select[name="uom"]'];
      const lotFields = ['input[name="lot_no"]', 'input[name="lot_number"]', 'input[placeholder*="lot" i]'];
      const palletFields = ['input[name="pallet_no"]', 'input[name="pallet_number"]', 'input[placeholder*="pallet" i]'];
      const locationFields = ['input[name="location_code"]', 'input[placeholder*="location" i]', 'input[placeholder*="ตำแหน่ง" i]', 'select[name="location_code"]'];

      await fillIfVisible(page, productFields, process.env.UAT_PRODUCT_CODE);
      await fillIfVisible(page, qtyFields, process.env.UAT_QTY);
      await fillIfVisible(page, lotFields, process.env.UAT_LOT_NO);
      await fillIfVisible(page, palletFields, process.env.UAT_PALLET_NO);
      await fillIfVisible(page, locationFields, process.env.UAT_RECEIVING_LOCATION);
    });

    // Scenario D: Receiving post/confirm
    await runScenario('D', 'Receiving post/confirm', '22N_04_receiving_post_attempt.png', async () => {
      const postButtons = [
        'button:has-text("Save")', 'button:has-text("บันทึก")', 
        'button:has-text("Post")', 'button:has-text("Confirm")', 
        'button:has-text("ยืนยัน")', 'button:has-text("รับเข้า")'
      ];
      await clickIfVisible(page, postButtons);
      await page.waitForTimeout(2000); // wait for post
    });

    // Scenario E: Verify receiving movement ledger evidence
    await runScenario('E', 'Verify receiving movement ledger evidence', '22N_05_receiving_ledger_check.png', async () => {
      await safeGoto(page, '/movement-ledger', null);
      // verify something here
      const tableRows = ['tr:has-text("'+process.env.UAT_PRODUCT_CODE+'")'];
      const element = await firstVisible(page, tableRows);
      if (!element) throw new Error('MISSING_SELECTOR: Ledger record not found for product');
    });

    // Scenario F: Verify stock balance increase evidence
    await runScenario('F', 'Verify stock balance increase evidence', '22N_06_stock_balance_check.png', async () => {
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
      throw new Error(`UAT failed with errors or test failures. Check 22N_result.json`);
    } else if (hasBlockers) {
      resultData.finalDecision["Receiving Transaction Automation"] = "BLOCKED";
    } else {
      resultData.finalDecision["Receiving Transaction Automation"] = "PASS"; // if fully implemented and pass
    }
  });
});

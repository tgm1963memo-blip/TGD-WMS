import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl, login } from './helpers/uatAuth.js';

requireUatCredentials();

// Covers the new contract-terms fields added to the Product Service Rates
// admin page (min charge / contract start-end date / free days / discount /
// contract note). These tests only exercise the UI layer (render, fill,
// cancel) — they do NOT attempt to save, since the new columns
// (min_charge_amount, contract_start_date, contract_end_date, free_days,
// discount_percent, contract_note) require the Part A migration to exist on
// the target Supabase project first. Saving before that migration lands
// would fail with a "column does not exist" error from PostgREST — that's
// expected, not a bug, and is exactly why this suite stays read/UI-only
// until RUN_CONTRACT_TERMS_SAVE_E2E is explicitly opted into (see below).
test.describe('Billing contract terms — rate admin UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page); // UAT_EMAIL/UAT_PASSWORD resolve to the admin account
    await gotoUrl(page, `${getBaseUrl()}/admin/product-service-rates`);
    await expect(page.locator('[data-testid="product-service-rates-page"]')).toBeVisible({ timeout: 20000 });
  });

  test('opening the add-rate form renders the contract-terms section with all 6 fields', async ({ page }) => {
    await page.locator('[data-testid="add-service-rate-button"]').click();
    const section = page.locator('[data-testid="rate-contract-terms-section"]');
    await expect(section).toBeVisible();

    await expect(page.locator('[data-testid="rate-contract-start-date-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-contract-end-date-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-min-charge-amount-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-free-days-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-discount-percent-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-contract-note-input"]')).toBeVisible();
  });

  test('contract-terms fields accept input and are cleared on cancel without saving anything', async ({ page }) => {
    await page.locator('[data-testid="add-service-rate-button"]').click();

    await page.locator('[data-testid="rate-min-charge-amount-input"]').fill('500');
    await page.locator('[data-testid="rate-free-days-input"]').fill('7');
    await page.locator('[data-testid="rate-discount-percent-input"]').fill('10');
    await page.locator('[data-testid="rate-contract-note-input"]').fill('E2E_TEST — should never be saved');

    await expect(page.locator('[data-testid="rate-min-charge-amount-input"]')).toHaveValue('500');
    await expect(page.locator('[data-testid="rate-discount-percent-input"]')).toHaveValue('10');

    // Cancel closes the modal without ever calling upsertProductServiceRate —
    // confirms the form is inert until Submit, so no partial/test data can
    // leak into the real rate table just from filling the fields in.
    await page.locator('[data-testid="rate-form-cancel-button"]').click();
    await expect(page.locator('[data-testid="rate-contract-terms-section"]')).toHaveCount(0);
  });

  test('editing an existing rate pre-fills contract-terms fields from its current values', async ({ page }) => {
    const editButtons = page.locator('[data-testid="storage-rate-table"] button', { hasText: 'แก้ไข' });
    const count = await editButtons.count();
    test.skip(count === 0, 'No existing rate rows to open for editing');

    await editButtons.first().click();
    await expect(page.locator('[data-testid="rate-contract-terms-section"]')).toBeVisible();
    // Just confirms the inputs are present and controlled (no crash reading
    // row.min_charge_amount/contract_start_date/etc. from a real row that
    // predates these columns and has them as null/undefined).
    await expect(page.locator('[data-testid="rate-min-charge-amount-input"]')).toHaveValue('');
    await page.locator('[data-testid="rate-form-cancel-button"]').click();
  });

  test.describe('Save round-trip (opt-in, requires Part A migration already applied)', () => {
    test.skip(
      process.env.RUN_CONTRACT_TERMS_SAVE_E2E !== 'true',
      'Opt-in only — saving a real rate row with contract fields requires the Part A migration; set RUN_CONTRACT_TERMS_SAVE_E2E=true after applying it',
    );

    test('saves min_charge/free_days/discount/contract dates and reloads them correctly', async ({ page }) => {
      await page.locator('[data-testid="add-service-rate-button"]').click();
      await page.locator('[data-testid="rate-form-customer-select"]').selectOption({ index: 1 });
      await page.locator('[data-testid="rate-form-product-select"]').selectOption({ index: 1 });
      await page.locator('[data-testid="rate-form-rate-input"]').fill('9.99');
      await page.locator('[data-testid="rate-min-charge-amount-input"]').fill('500');
      await page.locator('[data-testid="rate-free-days-input"]').fill('7');
      await page.locator('[data-testid="rate-discount-percent-input"]').fill('10');
      await page.locator('[data-testid="rate-contract-note-input"]').fill('E2E_TEST contract row');
      await page.locator('[data-testid="rate-form-save-button"]').click();

      await expect(page.locator('.banner-danger')).toHaveCount(0);
      await expect(page.getByText('E2E_TEST contract row')).toBeVisible({ timeout: 10000 });
    });
  });
});

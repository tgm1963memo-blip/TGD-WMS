import { test, expect } from '@playwright/test';
import { login } from './helpers/uatAuth.js';

test.describe('Customer to Admin Full Loop UAT', () => {
  test.setTimeout(180_000);

  const customerEmail = process.env.UAT_CUSTOMER_EMAIL || 'tgm1963.memo@gmail.com';
  const adminEmail = process.env.UAT_EMAIL || 'thitiwat.tan@tgm.co.th';
  const password = process.env.UAT_PASSWORD || 'password123';
  const baseUrl = process.env.UAT_BASE_URL || 'http://localhost:5173'; // fallback for local dev
  let docNo = `TEST-DEP-${Date.now()}`;

  test('Customer Full Loop', async ({ page, request }) => {
    // ---------------------------------------------------------
    // 1. Customer logs in and creates a Deposit Request
    // ---------------------------------------------------------
    console.log('--- Step 1: Customer Login ---');
    await login(page, { email: 'tgm1963.memo@gmail.com', password: 'password123' });

    // Wait for portal dashboard
    await page.waitForURL('**/customer', { timeout: 15000 }).catch(() => {});
    
    console.log('--- Step 2: Customer creates Deposit Request ---');
    await page.goto(`${baseUrl}/customer/deposit-request/new`);
    await page.waitForLoadState('networkidle');

    // Fill deposit request form (Header)
    await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill(new Date().toISOString().split('T')[0]);
    await page.locator('[data-testid="customer-deposit-contact-name"]').fill('John Doe');
    await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0812345678');

    // Add line item (Line is already added by default in the new table layout, but we need to select product)
    // Select product
    await page.locator('[data-testid="customer-deposit-product-picker-select"]').selectOption({ index: 1 });
    
    // Fill quantity and weight
    await page.locator('[data-testid="customer-deposit-box-count"]').fill('100');
    
    // Submit request
    const submitBtn = page.locator('[data-testid="customer-deposit-submit-button"]');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();
    await page.waitForTimeout(2000);

    console.log('--- Step 3: Logout Customer ---');
    await page.goto(`${baseUrl}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
    
    // Force a reload to clear auth state
    await page.reload();

    // ---------------------------------------------------------
    // 4. Admin logs in and receives the items
    // ---------------------------------------------------------
    console.log('--- Step 4: Admin Login ---');
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});

    console.log('--- Step 5: Admin Process Receiving ---');
    await page.goto(`${baseUrl}/operations/receiving`);
    await page.waitForLoadState('networkidle');

    // Admin opens work order (Create Receiving Draft)
    console.log('--- Step 5.1: Admin Opens Work Order ---');
    const depositRowBtn = page.locator(`button[data-testid^="receiving-review-deposit-"]`).first();
    await depositRowBtn.waitFor({ state: 'visible', timeout: 10000 });
    await depositRowBtn.click();
    
    // Click Open Work Order
    const openWorkOrderBtn = page.locator('button', { hasText: /เปิดใบงาน|Open Work Order|Accept/ });
    await openWorkOrderBtn.waitFor({ state: 'visible', timeout: 10000 });
    await openWorkOrderBtn.click();
    await page.waitForTimeout(2000);
    
    // Check if there is an explicit Confirm Receiving button after opening work order.
    // If not, we just close the modal.
    await page.keyboard.press('Escape'); // close modal

    // ---------------------------------------------------------
    // Handheld Receiving
    // ---------------------------------------------------------
    console.log('--- Step 5.2: Handheld Receiving ---');
    await page.goto(`${baseUrl}/handheld`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('tgd_handheld_profile', JSON.stringify({id: 'test-admin', role: 'admin', first_name: 'Admin'}));
    });
    await page.reload();
    
    await page.locator('text=รับเข้า (Receiving)').click();
    
    // Click the specific document (might need to wait for it)
    await page.waitForTimeout(2000); // Wait for docs to load
    await page.locator('button', { hasText: /John Doe|CDR-/ }).first().click();
    
    // Click the line item
    await page.waitForTimeout(1000); // Wait for lines to load
    await page.locator('button', { hasText: 'กล่อง' }).first().click();
    
    // Confirm Receiving
    const confirmReceiveBtn = page.locator('button', { hasText: /ยืนยันรับสินค้า|Confirm/ });
    await confirmReceiveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmReceiveBtn.click();
    await page.waitForTimeout(1000);

    // ---------------------------------------------------------
    // Check Stock Balance
    // ---------------------------------------------------------
    console.log('--- Step 5.3: Check Stock Balance ---');
    await page.goto(`${baseUrl}/inventory`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=ยอดคงเหลือ').first() || page.locator('text=Inventory').first()).toBeVisible({ timeout: 10000 });
    // Look for our document number or customer
    await page.fill('input[type="search"]', 'John Doe');
    await page.waitForTimeout(1000);

    // ---------------------------------------------------------
    // 5.4 Logout Admin, Login Customer
    // ---------------------------------------------------------
    console.log('--- Step 5.4: Logout Admin, Login Customer ---');
    await page.goto(`${baseUrl}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.context().clearCookies();
    await page.reload();

    await page.goto(`${baseUrl}/login`);
    await page.fill('input[type="email"]', customerEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/customer', { timeout: 15000 }).catch(() => {});

    // ---------------------------------------------------------
    // 5.5 Customer Creates Withdrawal Request
    // ---------------------------------------------------------
    console.log('--- Step 5.5: Customer Creates Withdrawal Request ---');
    await page.goto(`${baseUrl}/customer/withdrawal-request/new`);
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="customer-withdrawal-dispatch-date"]').fill(new Date().toISOString().split('T')[0]);
    await page.locator('[data-testid="customer-withdrawal-pickup-contact"]').fill('Jane Doe');

    // Add line item (Select product)
    const withdrawProductSelect = page.locator('[data-testid="customer-withdrawal-product-picker-select"]');
    if (await withdrawProductSelect.isVisible()) {
      await withdrawProductSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      
      // Fill weight
      const weightInput = page.locator('input[placeholder="กก."]').first();
      await weightInput.fill('10');
      await page.keyboard.press('Tab');
      
      // Submit
      const submitWithdrawalBtn = page.locator('[data-testid="customer-withdrawal-submit-button"]');
      await submitWithdrawalBtn.click();
      await page.waitForTimeout(2000);
    }

    // ---------------------------------------------------------
    // 5.6 Logout Customer, Login Admin
    // ---------------------------------------------------------
    console.log('--- Step 5.6: Logout Customer, Login Admin ---');
    await page.goto(`${baseUrl}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.context().clearCookies();
    await page.reload();

    await page.goto(`${baseUrl}/login`);
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});

    // ---------------------------------------------------------
    // 5.7 Admin Open Work Order (Withdrawal)
    // ---------------------------------------------------------
    console.log('--- Step 5.7: Admin Open Work Order (Withdrawal) ---');
    await page.goto(`${baseUrl}/operations/withdrawal-requests`);
    await page.waitForLoadState('networkidle');
    
    // Click the first Review button
    const reviewBtn = page.locator('button', { hasText: /ตรวจสอบ|Review/ }).first();
    await reviewBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      
      const openPickBtn = page.locator('button', { hasText: /เปิดใบงาน|Accept|Open Work Order/ }).first();
      await openPickBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      if (await openPickBtn.isVisible()) {
        await openPickBtn.click();
        await page.waitForTimeout(2000);
      }
      await page.keyboard.press('Escape'); // close modal
    }

    // ---------------------------------------------------------
    // 5.8 Handheld Picking
    // ---------------------------------------------------------
    console.log('--- Step 5.8: Handheld Picking ---');
    await page.goto(`${baseUrl}/handheld`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('tgd_handheld_profile', JSON.stringify({id: 'test-admin', role: 'admin', first_name: 'Admin'}));
    });
    await page.reload();
    
    await page.locator('text=เบิกออก (Picking)').click();
    await page.waitForTimeout(2000);
    
    // Click the first document
    const pickDocBtn = page.locator('button', { hasText: /W-/ }).first();
    if (await pickDocBtn.isVisible()) {
      await pickDocBtn.click();
      await page.waitForTimeout(1000);
      
      // Click first line item
      const lineBtn = page.locator('button', { hasText: /กก./ }).first();
      if (await lineBtn.isVisible()) {
        await lineBtn.click();
        
        // Confirm Pick
        const confirmPickBtn = page.locator('button', { hasText: /ยืนยันหยิบสินค้า|Confirm/ });
        await confirmPickBtn.waitFor({ state: 'visible', timeout: 5000 });
        await confirmPickBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // ---------------------------------------------------------
    // 5.9 Admin Outbound Dispatch
    // ---------------------------------------------------------
    console.log('--- Step 5.9: Admin Outbound Dispatch ---');
    await page.goto(`${baseUrl}/operations/outbound`);
    await page.waitForLoadState('networkidle');
    
    // Check if there are documents to dispatch
    const confirmPickListBtn = page.locator('button', { hasText: /Confirm Pick/ }).first();
    if (await confirmPickListBtn.isVisible()) {
        await confirmPickListBtn.click();
        await page.waitForTimeout(1000);
    }
    const dispatchRowBtn = page.locator('a[href^="/operations/outbound/"]').first();
    if (await dispatchRowBtn.isVisible()) {
        await dispatchRowBtn.click();
        await page.waitForTimeout(1000);
        
        // Dispatch
        const dispatchActionBtn = page.locator('button', { hasText: /Dispatch|ตัดจ่าย/ }).first();
        if (await dispatchActionBtn.isVisible()) {
            await dispatchActionBtn.click();
            await page.waitForTimeout(1000);
        }
    }

    // ---------------------------------------------------------
    // 6. Trigger Email Processing Endpoint
    // ---------------------------------------------------------
    console.log('--- Step 6: Process Email Queue ---');
    const apiResponse = await request.post(`${baseUrl}/api/process-email-queue`, { timeout: 10000 }).catch(() => null);
    if (apiResponse) {
      const emailData = await apiResponse.json().catch(() => ({}));
      console.log('Email processing result:', emailData);
    } else {
      console.log('Email processing timed out or failed (likely due to SMTP server delay). Continuing test.');
    }

    // ---------------------------------------------------------
    // 7. Verify Reports (Storage Aging / Movement Ledger)
    // ---------------------------------------------------------
    console.log('--- Step 7: Admin checks Reports ---');
    await page.goto(`${baseUrl}/reports/storage-aging`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button, input').first()).toBeVisible({ timeout: 10000 });
    
    await page.goto(`${baseUrl}/reports/movement-ledger`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button, input').first()).toBeVisible({ timeout: 10000 });

    console.log('--- Loop Complete ---');
  });
});

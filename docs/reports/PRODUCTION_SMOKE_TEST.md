# Production Smoke Test Results

**URL:** https://tgc-wms.vercel.app  
**Date:** 2026-06-26  
**Tool:** Playwright (`post-uat-04-admin-inventory-balance.spec.js`)

## Results: 11/11 PASS

| # | Test | Result |
|---|------|--------|
| 01 | Page loads without fatal error | ✅ |
| 02 | Page title "ยอดคงเหลือสินค้า" | ✅ |
| 03 | Withdrawal deduction description | ✅ |
| 04 | Stat cards (กล่อง/น้ำหนักคงเหลือรวม) | ✅ |
| 05 | Column "คงเหลือ (กล่อง)" not "รับเข้า" | ✅ |
| 06 | Zero-balance footer text | ✅ |
| 07 | Customer filter renders | ✅ |
| 08 | Customer filter client-side | ✅ |
| 09 | Expand/collapse rows | ✅ |
| 10 | Detail modal | ✅ |
| 11 | Numeric balance values (no NaN) | ✅ |

**Duration:** 2.9 minutes  
**Command:**
```powershell
$env:PLAYWRIGHT_BASE_URL="https://tgc-wms.vercel.app"
$env:PLAYWRIGHT_SKIP_WEBSERVER="1"
npx playwright test tests/e2e/post-uat-04-admin-inventory-balance.spec.js
```

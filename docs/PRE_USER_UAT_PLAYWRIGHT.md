# Pre-User UAT Playwright

Playwright smoke suite ก่อนให้ผู้ใช้งานจริงทดสอบ UAT

**Checklist สำหรับผู้ใช้จริง (ภาษาไทย):** [BUSINESS_USER_UAT_CHECKLIST_TH.md](./uat/BUSINESS_USER_UAT_CHECKLIST_TH.md)

## Prerequisites

- `.env.local` ต้องมีอย่างน้อย:
  - `UAT_BASE_URL` — URL Vercel UAT
  - `UAT_EMAIL` / `UAT_PASSWORD` (เช่น `accounting.demo`)
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ชี้ UAT
- ทดสอบกับโค้ดล่าสุดบนเครื่อง: ตั้ง `PLAYWRIGHT_BASE_URL=http://localhost:5173` — config จะสตาร์ท `npm run dev` ให้อัตโนมัติ
- ทดสอบกับ Vercel หลัง deploy: ตั้ง `PLAYWRIGHT_SKIP_WEBSERVER=1` และใช้ `UAT_BASE_URL` จาก `.env.local`

## Optional customer write credentials

```env
UAT_CUSTOMER_EMAIL=customer.demo@tgd-wms.local
UAT_CUSTOMER_PASSWORD=... # same as UAT_PASSWORD unless overridden
```

บัญชีต้องเป็น `customer_admin` หรือ `customer_user` ที่มี `customer_id`

สร้างบัญชีตัวอย่างบน UAT:

```bash
node scripts/uat-bootstrap-customer-demo.mjs
```

## Commands

```bash
npm test
npm run build

# Local (สตาร์ท dev server อัตโนมัติ)
$env:PLAYWRIGHT_BASE_URL='http://localhost:5173'
npm run test:e2e:pre-uat

# Vercel (หลัง deploy แล้ว)
$env:PLAYWRIGHT_SKIP_WEBSERVER='1'
Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
npm run test:e2e:vercel:core

# รวม Billing (ต้องมีบัญชี accounting)
npm run test:e2e:vercel

# Customer demo user flow (catalog + deposit)
npm run test:e2e:customer-demo

# Full business flow: ฝาก → จัดเก็บ → เบิก → จ่ายออก (ต้องมี UAT credentials + master data ใน .env.local)
npm run test:e2e:full-flow
```

### ตัวแปรสำหรับ Full Flow (`test:e2e:full-flow`)

```env
UAT_BASE_URL=https://tgd-wms.vercel.app
UAT_EMAIL=...
UAT_PASSWORD=...

# แนะนำ — ถ้าไม่ตั้ง Playwright จะเลือก option แรกจาก dropdown อัตโนมัติ
UAT_CUSTOMER_CODE=
UAT_WAREHOUSE_CODE=
UAT_PRODUCT_CODE=
UAT_LOT_NO=
UAT_PALLET_NO=
UAT_QTY=1
UAT_RECEIVING_LOCATION=

# Optional — ขั้นตอน customer deposit
UAT_CUSTOMER_EMAIL=
UAT_CUSTOMER_PASSWORD=
```

Evidence: `uat-evidence/full-deposit-to-dispatch-flow/result.json` + screenshots ต่อ step

### บัญชีสำหรับ Billing E2E

```env
UAT_BILLING_EMAIL=accounting.demo@...
UAT_BILLING_PASSWORD=...
```

ถ้าไม่มี `UAT_BILLING_*` และบัญชีหลักไม่ใช่ `accounting` / `admin` / `warehouse_manager` — ชุด Billing จะ skip อัตโนมัติ

## Evidence

- System smoke: `uat-evidence/pre-user-uat/result.json` + screenshots ต่อ route
- HTML report: `playwright-report/` หลังรันเสร็จ

## Scope

- **ครอบคลุม:** ทุก route หลัก, customer portal live data, billing regression, forbidden execution buttons
- **ยังเป็น demo:** warehouse receiving/picking-loading
- **ไม่รัน:** Gate 3B-5 Bplus export execute

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
UAT_CUSTOMER_EMAIL=admin.demo@...
UAT_CUSTOMER_PASSWORD=...
```

บัญชีต้องเป็น `customer_admin` หรือ `customer_user` ที่มี `customer_id`

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
npm run test:e2e:vercel
```

## Evidence

- System smoke: `uat-evidence/pre-user-uat/result.json` + screenshots ต่อ route
- HTML report: `playwright-report/` หลังรันเสร็จ

## Scope

- **ครอบคลุม:** ทุก route หลัก, customer portal live data, billing regression, forbidden execution buttons
- **ยังเป็น demo:** warehouse receiving/picking-loading
- **ไม่รัน:** Gate 3B-5 Bplus export execute

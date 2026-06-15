# Pre-User UAT Playwright

Playwright smoke suite ก่อนให้ผู้ใช้งานจริงทดสอบ UAT

## Prerequisites

- `.env.local` ต้องมีอย่างน้อย:
  - `UAT_EMAIL` / `UAT_PASSWORD` (เช่น `accounting.demo`)
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ชี้ UAT
- ทดสอบกับโค้ดล่าสุดบนเครื่อง: ตั้ง `PLAYWRIGHT_BASE_URL=http://localhost:5173` (ค่าเริ่มต้น) — config จะสตาร์ท `npm run dev` ให้อัตโนมัติ
- ทดสอบกับ deployment ที่ deploy แล้ว: ตั้ง `PLAYWRIGHT_BASE_URL` หรือ `UAT_BASE_URL` เป็น URL Vercel และ `PLAYWRIGHT_SKIP_WEBSERVER=1`

## Optional customer write credentials

ถ้าต้องการทดสอบการบันทึก draft จริง (ไม่ใช่แค่ scope guard):

```env
UAT_CUSTOMER_EMAIL=admin.demo@...
UAT_CUSTOMER_PASSWORD=...
```

บัญชีต้องเป็น `customer_admin` หรือ `customer_user` ที่มี `customer_id`

## Commands

```bash
npm test
npm run build
npm run test:e2e:system
npm run test:e2e:customer
npm run test:e2e
```

## Evidence

- System smoke: `uat-evidence/pre-user-uat/result.json` + screenshots ต่อ route
- HTML report: `playwright-report/` หลังรันเสร็จ

## Scope

- **ครอบคลุม:** ทุก route หลักจาก navigation, customer portal live data, billing regression, forbidden execution buttons
- **ยังเป็น demo:** warehouse receiving/picking-loading, admin receiving verification
- **ไม่รัน:** Gate 3B-5 Bplus export execute, stock movement execution จาก portal

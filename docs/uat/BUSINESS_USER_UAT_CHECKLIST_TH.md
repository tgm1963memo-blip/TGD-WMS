# Checklist UAT สำหรับผู้ใช้งานจริง (TGD WMS Cold Storage)

**สภาพแวดล้อม:** UAT (Staging) — Production ยัง HOLD  
**เวอร์ชันอ้างอิง:** commit `6427183` ขึ้นไป (Customer Portal Live Data + Pre-UAT Playwright)  
**วันที่ทดสอบ:** _______________  
**ผู้ทดสอบ:** _______________

---

## ก่อนเริ่มทดสอบ

| รายการ | ผล (ผ่าน/ไม่ผ่าน) | หมายเหตุ |
|--------|-------------------|----------|
| เปิด URL UAT ที่ทีม IT แจก (Vercel) ได้ | | |
| เห็นแบนเนอร์ **CONTROLLED UAT ENVIRONMENT** | | |
| Login ด้วยบัญชีที่ได้รับ (อีเมล/รหัสผ่าน) | | |
| ภาษาไทยเป็นค่าเริ่มต้น และสลับ EN ได้ | | |

### บัญชีทดสอบ (ตัวอย่าง UAT)

| บทบาท | ใช้ทดสอบอะไร |
|--------|----------------|
| `accounting` | รายงาน Billing, Invoice Drafts (อ่าน/สร้าง draft) — ตั้ง `UAT_BILLING_EMAIL` สำหรับ Playwright Billing |
| `customer_admin` + `customer_id` | ฝาก/เบิกสินค้าใน Customer Portal (บันทึก draft จริง) — ตั้ง `UAT_CUSTOMER_EMAIL` |
| `warehouse_staff` / `warehouse_manager` | หน้าปฏิบัติการคลัง |
| `admin` | ทุกเมนู + Admin review |
| บัญชีทั่วไป (เช่น email องค์กร) | ทดสอบ login, portal อ่าน, รายงานทั่วไป — **ไม่** ทดสอบ Invoice Draft write |

---

## ส่วนที่ 1 — เข้าสู่ระบบและโปรไฟล์

| ID | ขั้นตอน | ผลที่คาดหวัง | ผลจริง | สถานะ | หลักฐาน |
|----|---------|--------------|--------|-------|---------|
| TH-01 | เปิด `/login` | หน้า login โหลดได้ | | ☐ ผ่าน ☐ ไม่ผ่าน | |
| TH-02 | Login สำเร็จ | เข้า Dashboard / เมนูหลัก | | ☐ ผ่าน ☐ ไม่ผ่าน | |
| TH-03 | เปิดเมนูผู้ใช้ | เห็นอีเมลที่ login | | ☐ ผ่าน ☐ ไม่ผ่าน | |
| TH-04 | เปิด `/settings/profile` | เห็นอีเมล + บทบาท (role) | | ☐ ผ่าน ☐ ไม่ผ่าน | |
| TH-05 | Logout | กลับหน้า login | | ☐ ผ่าน ☐ ไม่ผ่าน | |

---

## ส่วนที่ 2 — Customer Portal (ข้อมูลจริงจาก UAT)

> ทุกหน้าต้องมีแบนเนอร์ **ข้อมูลสด / Live data** (ไม่ใช่ Demo banner เก่า)

| ID | ขั้นตอน | บทบาทที่แนะนำ | ผลที่คาดหวัง | สถานะ | หมายเหตุ |
|----|---------|---------------|--------------|-------|----------|
| CP-01 | เปิด `/customer` | ทุกบทบาท | เห็น KPI + Quick actions | ☐ | |
| CP-02 | เปิด **ฝากสินค้า** `/customer/deposit-request` | customer_admin | กรอกฟอร์ม → บันทึก draft สำเร็จ (เลขคำขอ) | ☐ | บัญชีไม่มี customer_id จะเห็นข้อความเตือน — ถูกต้อง |
| CP-03 | เปิด **ยอดสต็อก** `/customer/stock-balance` | customer_admin | ตารางโหลดได้ (ว่างหรือมีข้อมูล) | ☐ | |
| CP-04 | เปิด **เบิกสินค้า** `/customer/withdrawal-request` | customer_admin | บันทึก draft หรือข้อความ scope guard | ☐ | |
| CP-05 | เปิด **ประวัติคำขอ** `/customer/requests` | ทุกบทบาท | ตารางประวัติโหลดได้ | ☐ | |
| CP-06 | Admin ตรวจคำขอฝาก `/customer/admin/deposit-review` | admin/accounting | ตาราง review โหลดได้ | ☐ | |
| CP-07 | Admin ตรวจคำขอเบิก `/customer/admin/withdrawal-review` | admin/accounting | ตาราง review โหลดได้ | ☐ | |

### ยังเป็น Demo (ไม่กระทบสต็อกจริง)

| ID | หน้า | ผลที่คาดหวัง |
|----|------|--------------|
| CP-D1 | Warehouse Receiving demo | ทำ workflow จำลองได้ ไม่มีปุ่ม post จริง |
| CP-D2 | Picking/Loading demo | สแกน barcode จำลองได้ ไม่มี dispatch จริง |

---

## ส่วนที่ 3 — ปฏิบัติการคลัง (อ่าน/ทบทวน)

| ID | หน้า | ผลที่คาดหวัง | สถานะ |
|----|------|--------------|-------|
| WH-01 | Receiving | รายการโหลดได้ ไม่มี post ที่ห้ามใช้ | ☐ |
| WH-02 | Putaway | หน้าโหลดได้ | ☐ |
| WH-03 | Stock Count | หน้าโหลดได้ | ☐ |
| WH-04 | Transfer / Adjustment | หน้าโหลดได้ | ☐ |
| WH-05 | Withdrawal / Picking / Dispatch | หน้าโหลดได้ ไม่มีปุ่มยืนยันที่ห้ามใช้ | ☐ |
| WH-06 | Handheld | หน้าสแกนโหลดได้ | ☐ |

---

## ส่วนที่ 4 — รายงานและ Billing

| ID | หน้า | บทบาท | ผลที่คาดหวัง | สถานะ |
|----|------|-------|--------------|-------|
| RP-01 | `/reports` (สรุปรายงาน) | viewer+ | ไม่ crash — เห็นการ์ดรายงานตามสิทธิ์ | ☐ |
| RP-02 | Movement Ledger | viewer+ | โหลดได้ | ☐ |
| RP-03 | Storage Aging | viewer+ | โหลดได้ | ☐ |
| RP-04 | Billing Movement Weight | accounting | โหลดได้ มีปุ่มสร้าง draft (ถ้ามีสิทธิ์) | ☐ |
| RP-05 | Invoice Drafts | accounting | รายการ draft โหลดได้ | ☐ |

### สิ่งที่ต้อง **ไม่** เห็น (Gate 3B)

| ID | ตรวจสอบ | ผลที่คาดหวัง | สถานะ |
|----|---------|--------------|-------|
| BL-F1 | ปุ่ม Export Bplus | **ไม่มี** | ☐ |
| BL-F2 | ปุ่ม Mark Billed | **ไม่มี** | ☐ |
| BL-F3 | ช่อง Bplus Invoice No | **ไม่มี** | ☐ |

---

## ส่วนที่ 5 — สิทธิ์ตามบทบาท

| ID | ทดสอบ | ผลที่คาดหวัง | สถานะ |
|----|-------|--------------|-------|
| RL-01 | accounting login → เมนู Billing ใน sidebar | เห็น Invoice Drafts | ☐ |
| RL-02 | viewer login → เมนู Billing Invoice Drafts | **ไม่เห็น** หรือเข้าไม่ได้ | ☐ |
| RL-03 | customer_admin → Customer Portal write | บันทึก draft ได้ | ☐ |

---

## ส่วนที่ 6 — ข้อจำกัดที่ยังไม่เปิด (ไม่นับเป็น Fail)

- Gate **3B-5** — Execute Bplus export / Mark BILLED
- Gate **2G** — อัปโหลดไฟล์แนบไป Storage + อีเมลแจ้งลูกค้า
- Gate **2H** — Handheld เชื่อม execution จริง (portal → receiving)
- Production go-live / backup drill

---

## สรุปผล UAT

| รายการ | จำนวน |
|--------|-------|
| ผ่าน | |
| ไม่ผ่าน | |
| Blocked | |

**ข้อบกพร่องที่พบ (ถ้ามี):**

1. _______________________________________________
2. _______________________________________________

**ลงชื่อผู้ทดสอบ:** _______________  **วันที่:** _______________  
**ลงชื่อผู้ทบทวน (IT/Controller):** _______________  **วันที่:** _______________

---

## อ้างอิงการทดสอบอัตโนมัติ (ทีม IT)

```powershell
# บนเครื่อง dev (โค้ดล่าสุด)
$env:PLAYWRIGHT_BASE_URL='http://localhost:5173'
npm run test:e2e:pre-uat

# บน Vercel หลัง deploy
$env:PLAYWRIGHT_SKIP_WEBSERVER='1'
npm run test:e2e:vercel
```

รายละเอียดเพิ่ม: `docs/PRE_USER_UAT_PLAYWRIGHT.md`

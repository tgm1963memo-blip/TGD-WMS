# คำขอยืนยันข้อกำหนดการ Export Invoice Draft ไป Bplus
## TGD WMS Cold Storage — Gate 3B-5 (Pre-Implementation)

| รายการ | รายละเอียด |
|--------|------------|
| โครงการ | TGD WMS Cold Storage |
| Gate | 3B-5 — Bplus Export Execute (ยังไม่เริ่มพัฒนา) |
| สถานะเอกสาร | รอการยืนยันจากทีมบัญชี / Bplus |
| วันที่จัดทำ | 2026-06-08 |
| ผู้จัดทำ | ทีมพัฒนา TGD WMS |
| อ้างอิง | Gate 3B-4 CLOSED — Bplus Export Readiness Preview |

---

## 1. วัตถุประสงค์

ระบบ **TGD WMS Cold Storage** สามารถสร้าง **Invoice Draft** จากน้ำหนักการเคลื่อนไหวสินค้า (billing movement weight) อนุมัติ draft ได้ และแสดง **Bplus Export Readiness Preview** (อ่านอย่างเดียว) บน UAT แล้ว

ทีมพัฒนาต้องการเตรียมขั้นตอน **Export ข้อมูล Invoice Draft ไป Bplus** ใน Gate ถัดไป (Gate 3B-5) แต่ **ยังไม่เริ่มพัฒนาหรือส่งออกข้อมูลจริง** จนกว่าทีมบัญชีและผู้ใช้งาน Bplus จะยืนยันรูปแบบข้อมูล การ map รหัสลูกค้า/บริการ/VAT และนโยบายการควบคุม export

เอกสารฉบับนี้จัดทำเพื่อ:

- อธิบายข้อมูลที่ WMS มีและจะส่งออก
- รวบรวมคำถามที่ต้องการคำตอบจากบัญชี/Bplus
- เสนอ business rule จากฝั่ง WMS (รอการยืนยัน)
- กำหนด checklist สิ่งที่ต้องได้ก่อนเริ่มพัฒนา Gate 3B-5

**หมายเหตุสำคัญ:** การตอบกลับเอกสารนี้ **ไม่ใช่** การอนุมัติให้ export จริงทันที — เป็นการยืนยันข้อกำหนดก่อนเริ่มพัฒนาเท่านั้น

---

## 2. สถานะระบบปัจจุบัน

| ความสามารถ | สถานะ |
|------------|--------|
| สร้าง Invoice Draft จาก billing movement | ใช้งานได้ (UAT) |
| อนุมัติ Invoice Draft (Approve) | ใช้งานได้ |
| ยกเลิก Draft (Cancel) — เฉพาะสถานะก่อนอนุมัติ | ใช้งานได้ |
| Preview Bplus Readiness (อ่านอย่างเดียว) | ใช้งานได้ — Gate 3B-4 ปิดแล้ว |
| Export ไฟล์ไป Bplus จริง | **ยังไม่มี** |
| เปลี่ยนสถานะเป็น EXPORTED_TO_BPLUS | **ยังไม่มี** |
| Mark BILLED | **ยังไม่มี** |
| กรอก / บันทึก Bplus Invoice No | **ยังไม่มี** |
| สร้าง Tax Invoice / AR module | **ยังไม่มี** |

**ตัวอย่าง UAT ปัจจุบัน**

- Draft ตัวอย่าง: `BID-20260611-0002` — สถานะ **APPROVED**
- Readiness Preview แสดง **BLOCKED** เพราะ UAT ยังไม่มี **Bplus customer code** ใน master data
- ไม่มีการเปลี่ยนแปลงข้อมูลจากการ preview — เป็น read-only

---

## 3. ตัวอย่างข้อมูลจาก WMS ที่จะส่งออก

ข้อมูลด้านล่างมาจาก Invoice Draft ที่อนุมัติแล้ว (APPROVED) และ readiness preview ปัจจุบัน ชื่อ field อาจปรับให้ตรงกับรูปแบบ import ของ Bplus หลังได้รับการยืนยัน

### 3.1 ระดับ Header (หัวเอกสาร Draft)

| Field WMS | คำอธิบาย | ตัวอย่าง / หมายเหตุ |
|-----------|----------|-------------------|
| `draft_no` | เลขอ้างอิง Invoice Draft ใน WMS | `BID-20260611-0002` |
| `customer_name` | ชื่อลูกค้า | จาก draft หรือ customer master (`name`) |
| `customer_code` / Bplus customer code | รหัสลูกค้าสำหรับ Bplus | **UAT ยังไม่มี** — ต้องมี mapping ก่อน export |
| `billing_period` | งวดบิล (YYYY-MM) | derive จากช่วง billing period |
| `billing_period_start` / `billing_period_end` | วันเริ่ม–สิ้นสุดงวด | อาจใช้ใน note |
| `total_chargeable_weight` | น้ำหนักรวมที่คิดเงิน | ตัวเลข (kg) |
| `total_amount` | ยอดรวมเงิน | อาจเป็น null ถ้ายังไม่มี rate |
| `currency` | สกุลเงิน | default `THB` |
| `approved_at` | วันเวลาอนุมัติ | ระบบยังใช้ fallback จาก `updated_at` บางกรณี |
| `approved_by` | ผู้อนุมัติ | ยังไม่เก็บครบทุกกรณี |
| `note` | หมายเหตุ draft | optional |
| `internal_reference` | อ้างอิงภายใน | optional |

### 3.2 ระดับ Line (รายการใน Draft)

| Field WMS | คำอธิบาย | ตัวอย่าง / หมายเหตุ |
|-----------|----------|-------------------|
| `product_code` | รหัสสินค้า WMS | เช่น SKU จาก master |
| `product_name` | ชื่อสินค้า | |
| `lot_no` | เลข lot | |
| `pallet_no` | เลข pallet | optional |
| `movement_type` | ประเภทการเคลื่อนไหว | เช่น RECEIVE_CONFIRM, DISPATCH_CONFIRM |
| `movement_date` | วันที่เคลื่อนไหว | |
| `source_document_no` | เลขเอกสารต้นทาง | เช่น receiving / dispatch ref |
| `qty` | จำนวน | |
| `uom` | หน่วยนับ | เช่น kg |
| `chargeable_weight` | น้ำหนักที่คิดเงิน | **field หลักสำหรับ billing** |
| `rate` | อัตราค่าบริการ | อาจ null — รอ confirm นโยบาย |
| `amount` | จำนวนเงินรายการ | อาจ null — รอ confirm นโยบาย |
| `service_code` | รหัสบริการ Bplus (เสนอชั่วคราว) | infer จาก movement_type — **รอ confirm** |
| `vat_code` | รหัส VAT | **ยังไม่มีใน WMS** — รอ mapping |
| `revenue_account` | บัญชีรายได้ | **ยังไม่มีใน WMS** — รอ mapping |

### 3.3 Draft mapping movement_type → service_code (ยังไม่ยืนยัน)

| movement_type (WMS) | service_code ที่ WMS เสนอชั่วคราว |
|---------------------|-----------------------------------|
| RECEIVE_CONFIRM | INBOUND_HANDLING |
| DISPATCH_CONFIRM | OUTBOUND_HANDLING |
| PUTAWAY_CONFIRM | INBOUND_HANDLING |

**กรุณายืนยันหรือแก้ไข mapping นี้ให้ตรงกับ master ของ Bplus**

---

## 4. คำถามที่ต้องการคำตอบจากบัญชี / Bplus

### A. รูปแบบไฟล์ (Import Format)

| # | คำถาม |
|---|--------|
| A1 | Bplus รับข้อมูลแบบใด — **CSV, Excel, XML, API** หรือ **manual key-in**? |
| A2 | มี **sample import file** จาก Bplus ให้ทีมพัฒนาอ้างอิงได้หรือไม่? (ขอแนบไฟล์) |
| A3 | Encoding ที่ต้องใช้ — **UTF-8, TIS-620** หรืออื่น? |
| A4 | ถ้าเป็น CSV — **delimiter** ใช้อะไร? (comma, tab, semicolon) |
| A5 | โครงสร้างไฟล์ — **header และ line อยู่ sheet เดียว** หรือ **แยก sheet**? |
| A6 | **Required columns** ของ Bplus มีอะไรบ้าง? (รายการคอลัมน์บังคับ) |
| A7 | เลขเอกสารออกจากระบบใด — WMS ส่ง `draft_no` หรือให้ Bplus generate เอง? |
| A8 | รองรับการ export หลาย draft ในไฟล์เดียวหรือไม่? |

### B. Customer Mapping (รหัสลูกค้า)

| # | คำถาม |
|---|--------|
| B1 | ในไฟล์ import ของ Bplus — **Bplus customer code** ใช้ชื่อ field/column อะไร? |
| B2 | ควรเก็บ mapping ใน WMS ที่ **customer master** (`customer_code`) หรือ **ตาราง mapping แยก**? |
| B3 | ถ้าลูกค้า 1 รายมี **หลายรหัส Bplus** (เช่น หลายสาขา/นิติบุคคล) ต้องจัดการอย่างไร? |
| B4 | ถ้า **ไม่มี customer code** — ให้ **block export** (ห้ามส่ง) ใช่หรือไม่? |
| B5 | ชื่อลูกค้า (`customer_name`) ต้องตรงกับ master ใน Bplus หรือไม่? |

### C. Item / Service Mapping (รหัสสินค้า/บริการ)

| # | คำถาม |
|---|--------|
| C1 | **ค่าฝากสินค้า (cold storage)** ใช้ item/service code อะไรใน Bplus? |
| C2 | **Handling / receiving / dispatch** แยก code หรือใช้ code เดียว? |
| C3 | การ map จาก `movement_type` ของ WMS **เพียงพอหรือไม่**? (ดูตาราง 3.3) |
| C4 | ต้องเพิ่ม field **`billing_service_type`** บน invoice line ใน WMS หรือไม่? |
| C5 | ต้องมี **`bplus_item_code`** แยกจาก service code หรือไม่? |
| C6 | ต้อง export **revenue account ต่อ line** หรือไม่? |
| C7 | คิดค่าบริการจาก **weight, qty, ทั้งคู่ หรือ fixed amount**? |

### D. VAT / Accounting (ภาษีและบัญชี)

| # | คำถาม |
|---|--------|
| D1 | **VAT code** ที่ใช้สำหรับค่าบริการ cold storage คืออะไร? |
| D2 | จำนวนเงินในไฟล์ export = **ก่อน VAT** หรือ **รวม VAT**? |
| D3 | **Withholding tax (หัก ณ ที่จ่าย)** เกี่ยวข้องกับรายการนี้หรือไม่? |
| D4 | **Currency** ต้องเป็น THB เท่านั้นหรือไม่? |
| D5 | **Rounding rule** — ปัดเศษอย่างไร? (ทศนิยม 2 ตำแหน่ง, ต่อ line หรือต่อ draft) |
| D6 | ถ้า **rate / amount ยังไม่มีใน WMS** — ให้ **block export** หรืออนุญาตส่งเฉพาะ weight? |

### E. Export Control (การควบคุมหลัง Export)

| # | คำถาม |
|---|--------|
| E1 | Export ได้เฉพาะ draft สถานะ **APPROVED** ใช่หรือไม่? |
| E2 | หลัง Export สำเร็จ — ให้เปลี่ยนสถานะเป็น **EXPORTED_TO_BPLUS** ใช่หรือไม่? |
| E3 | หลัง Export แล้ว — **ห้ามแก้ไข draft** ใช่หรือไม่? |
| E4 | **Re-export** (ส่งซ้ำ) ทำได้หรือไม่? เงื่อนไขอย่างไร? |
| E5 | ถ้า export ผิด — ต้อง **void / cancel** อย่างไรใน Bplus และ WMS? |
| E6 | **ใครเป็นผู้ยืนยัน** ว่า Bplus เปิดบิล / บันทึกบัญชีแล้ว? |
| E7 | **Mark BILLED** ควรทำ **หลังมี Bplus invoice no** ใช่หรือไม่? (เสนอแยก Gate ถัดไป) |

---

## 5. Proposed Rule จากฝั่ง WMS (รอการยืนยัน)

ทีมพัฒนา **เสนอ** business rule ดังนี้ — กรุณายืนยัน แก้ไข หรือปฏิเสธเป็นหัวข้อ

| # | Rule ที่เสนอ | สถานะ |
|---|-------------|--------|
| PR-01 | Export ได้เฉพาะ draft สถานะ **APPROVED** และ readiness = **READY** | รอยืนยัน |
| PR-02 | **Missing Bplus customer code** = **block export** (ไม่ส่งไฟล์) | รอยืนยัน |
| PR-03 | **Missing rate/amount** = **block** หรือ **needs review** ตามที่บัญชีกำหนด | รอยืนยัน |
| PR-04 | Export สำเร็จ → เปลี่ยนสถานะเป็น **EXPORTED_TO_BPLUS** + บันทึก audit (วันที่, ผู้ export, batch) | รอยืนยัน |
| PR-05 | หลัง EXPORTED_TO_BPLUS — **ห้ามแก้ไข** draft และ lines | รอยืนยัน |
| PR-06 | **Mark BILLED** — แยก Gate ถัดไป (3B-6) ไม่รวมใน Gate 3B-5 | รอยืนยัน |
| PR-07 | **Bplus Invoice No** — แยก Gate ถัดไป (3B-6) ไม่รวมใน Gate 3B-5 | รอยืนยัน |
| PR-08 | Gate 3B-5 สร้างเฉพาะ **export file + batch record** — ไม่สร้าง Tax Invoice ใน WMS | รอยืนยัน |

---

## 6. สิ่งที่ต้องได้ก่อนเริ่มพัฒนา Gate 3B-5

Checklist สำหรับทีมบัญชี / Bplus และ Controller:

| # | รายการ | สถานะ | ผู้รับผิดชอบ |
|---|--------|--------|-------------|
| 1 | Sample import file จาก Bplus | ☐ ยังไม่ได้ | บัญชี / Bplus |
| 2 | Confirmed required columns | ☐ ยังไม่ได้ | บัญชี / Bplus |
| 3 | Confirmed customer code mapping (รวมข้อมูล UAT) | ☐ ยังไม่ได้ | Master data / บัญชี |
| 4 | Confirmed service / item code mapping | ☐ ยังไม่ได้ | บัญชี |
| 5 | Confirmed VAT / revenue account / amount basis | ☐ ยังไม่ได้ | บัญชี |
| 6 | Confirmed export / re-export / void policy | ☐ ยังไม่ได้ | บัญชี / Controller |
| 7 | Confirmed ผู้รับผิดชอบยืนยัน Bplus posting / Mark BILLED | ☐ ยังไม่ได้ | บัญชี / Controller |
| 8 | Controller อนุมัติเริ่ม Gate 3B-5 implementation | ☐ ยังไม่ได้ | Controller |

**Gate 3B-5 implementation จะเริ่มได้เมื่อ checklist ข้างต้นครบและได้รับอนุมัติอย่างเป็นทางการ**

---

## 7. ช่องให้บัญชีตอบกลับ

กรุณากรอกตารางด้านล่าง (สามารถ copy ไปกรอกใน Excel/Word แล้วส่งกลับได้)

### 7.1 รูปแบบไฟล์ (Section A)

| หัวข้อ | คำตอบบัญชี | ผู้ยืนยัน | วันที่ยืนยัน | หมายเหตุ |
|--------|------------|----------|-------------|----------|
| A1 รูปแบบไฟล์ (CSV/Excel/XML/API/manual) | | | | |
| A2 Sample file แนบแล้ว (ใช่/ไม่) | | | | |
| A3 Encoding | | | | |
| A4 Delimiter (ถ้า CSV) | | | | |
| A5 Header/Line structure | | | | |
| A6 Required columns | | | | |
| A7 เลขเอกสารจากระบบใด | | | | |
| A8 หลาย draft ต่อไฟล์ | | | | |

### 7.2 Customer Mapping (Section B)

| หัวข้อ | คำตอบบัญชี | ผู้ยืนยัน | วันที่ยืนยัน | หมายเหตุ |
|--------|------------|----------|-------------|----------|
| B1 ชื่อ field Bplus customer code | | | | |
| B2 เก็บ mapping ที่ไหนใน WMS | | | | |
| B3 ลูกค้า 1 รายหลายรหัส Bplus | | | | |
| B4 ไม่มี customer code → block export | | | | |
| B5 ชื่อลูกค้าต้องตรง master | | | | |

### 7.3 Item / Service Mapping (Section C)

| หัวข้อ | คำตอบบัญชี | ผู้ยืนยัน | วันที่ยืนยัน | หมายเหตุ |
|--------|------------|----------|-------------|----------|
| C1 รหัสค่าฝากสินค้า (storage) | | | | |
| C2 แยก code handling/receiving/dispatch | | | | |
| C3 movement_type mapping เพียงพอ | | | | |
| C4 ต้องมี billing_service_type | | | | |
| C5 ต้องมี bplus_item_code | | | | |
| C6 revenue account ต่อ line | | | | |
| C7 basis การคิดค่าบริการ | | | | |

### 7.4 VAT / Accounting (Section D)

| หัวข้อ | คำตอบบัญชี | ผู้ยืนยัน | วันที่ยืนยัน | หมายเหตุ |
|--------|------------|----------|-------------|----------|
| D1 VAT code | | | | |
| D2 amount ก่อน/หลัง VAT | | | | |
| D3 Withholding tax | | | | |
| D4 Currency | | | | |
| D5 Rounding rule | | | | |
| D6 rate/amount null → block หรือไม่ | | | | |

### 7.5 Export Control (Section E)

| หัวข้อ | คำตอบบัญชี | ผู้ยืนยัน | วันที่ยืนยัน | หมายเหตุ |
|--------|------------|----------|-------------|----------|
| E1 Export เฉพาะ APPROVED | | | | |
| E2 Status → EXPORTED_TO_BPLUS | | | | |
| E3 ห้ามแก้ draft หลัง export | | | | |
| E4 Re-export policy | | | | |
| E5 Void/cancel เมื่อ export ผิด | | | | |
| E6 ผู้ยืนยัน Bplus posting | | | | |
| E7 Mark BILLED หลัง Bplus invoice no | | | | |

### 7.6 ยืนยัน Proposed Rules (Section 5)

| Rule | เห็นด้วย (ใช่/ไม่/แก้ไข) | คำตอบบัญชี | ผู้ยืนยัน | วันที่ยืนยัน |
|------|-------------------------|------------|----------|-------------|
| PR-01 Export เฉพาะ APPROVED + READY | | | | |
| PR-02 Missing customer code = block | | | | |
| PR-03 Missing rate/amount policy | | | | |
| PR-04 Status EXPORTED_TO_BPLUS | | | | |
| PR-05 ห้ามแก้หลัง export | | | | |
| PR-06 Mark BILLED แยก Gate 3B-6 | | | | |
| PR-07 Bplus Invoice No แยก Gate 3B-6 | | | | |
| PR-08 ไม่สร้าง Tax Invoice ใน WMS | | | | |

### 7.7 ลายเซ็นรวม

| รายการ | รายละเอียด |
|--------|------------|
| ผู้ยืนยันฝั่งบัญชี | _________________________ |
| ตำแหน่ง | _________________________ |
| วันที่ | _________________________ |
| หมายเหตุเพิ่มเติม | |

---

## ภาคผนวก — Proposed Export Columns (PENDING CONFIRMATION)

คอลัมน์ด้านล่างเป็น **ข้อเสนอจาก WMS** — ต้องปรับให้ตรงกับ sample file ของ Bplus หลังได้รับการยืนยัน

| ลำดับ | Column (EN) | คำอธิบาย (TH) | Required (เสนอ) |
|-------|-------------|---------------|-----------------|
| 1 | document_ref | เลขอ้างอิง WMS (draft_no) | ใช่ |
| 2 | customer_code | รหัสลูกค้า Bplus | ใช่ |
| 3 | customer_name | ชื่อลูกค้า | ไม่บังคับ |
| 4 | billing_period | งวดบิล (YYYY-MM) | ใช่ |
| 5 | service_code | รหัสบริการ Bplus | ใช่ |
| 6 | item_code | รหัสสินค้า Bplus | รอยืนยัน |
| 7 | product_code | รหัสสินค้า WMS | รอยืนยัน |
| 8 | description | รายละเอียดรายการ | ไม่บังคับ |
| 9 | quantity | จำนวน | รอยืนยัน |
| 10 | unit | หน่วย | รอยืนยัน |
| 11 | weight | น้ำหนักคิดเงิน | ใช่ |
| 12 | rate | อัตรา | รอยืนยัน |
| 13 | amount | จำนวนเงิน | รอยืนยัน |
| 14 | vat_code | รหัส VAT | รอยืนยัน |
| 15 | revenue_account | บัญชีรายได้ | รอยืนยัน |
| 16 | currency | สกุลเงิน | รอยืนยัน |
| 17 | reference_note | หมายเหตุอ้างอิง | ไม่บังคับ |

---

*เอกสารนี้จัดทำเพื่อการยืนยันข้อกำหนดเท่านั้น — ไม่ใช่การอนุมัติให้ export ข้อมูลจริงหรือแตะ Production*

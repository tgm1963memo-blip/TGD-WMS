# Sprint 13B – Database Schema Foundation Validation Report

## สรุป (Summary)
- โครงสร้างสกีมามูลฐานของ TGD WMS ถูกสร้างตามข้อกำหนดของ Controller แล้ว ✅
- ไฟล์ที่ต้องการทั้งหมดถูกเพิ่มแล้ว (เอกสาร, migration, README, test) ✅
- การทดสอบ targeted ของสกีมาผ่านทั้งหมด (4 รายการ) ✅
- การทดสอบของ Sprint 13A ยังล้มเหลวอยู่ จึงต้องแก้ต่อใน Sprint 13A ก่อนดำเนินต่อไป ❌
- Build ของโปรเจคสำเร็จ (vite) ✅

## ไฟล์ที่เพิ่ม/อัปเดต (Files added/updated)
- `docs/database/tgd-wms-database-schema-foundation.md`
- `docs/database/tgd-wms-entity-relationship-map.md`
- `database/migrations/001_tgd_wms_schema_foundation.sql`
- `database/README.md`
- `tests/unit/database-schema-foundation.test.js`
- `docs/sprints/sprint-13b-database-schema-foundation-validation.md` (this file)

## กลุ่มตารางที่สร้าง (Schema groups created)
| กลุ่ม | ตาราง |
|------|-------|
| **A. Master Data** | tgd_customers, tgd_products, tgd_lots, tgd_warehouses, tgd_zones, tgd_locations, tgd_pallets |
| **B. Stock Foundation** | tgd_stock_balances, tgd_stock_movements |
| **C. Inbound / Receiving** | tgd_receiving_documents, tgd_receiving_lines, tgd_putaway_tasks |
| **D. Internal Movement** | tgd_transfer_documents, tgd_transfer_lines, tgd_adjustment_documents, tgd_adjustment_lines |
| **E. Stock Count** | tgd_stock_count_sessions, tgd_stock_count_lines |
| **F. Customer Withdrawal / Outbound** | tgd_withdrawal_requests, tgd_withdrawal_request_lines, tgd_allocation_records, tgd_picking_tasks, tgd_dispatch_documents, tgd_dispatch_lines |
| **G. Billing / Accounting Handoff** | tgd_operation_charges, tgd_monthly_storage_snapshots, tgd_accounting_charge_staging |
| **H. Security / Audit** | tgd_user_profiles, tgd_audit_logs |

## รายการตารางทั้งหมด (Full table list)
`tgd_customers`, `tgd_products`, `tgd_lots`, `tgd_warehouses`, `tgd_zones`, `tgd_locations`, `tgd_pallets`, `tgd_stock_balances`, `tgd_stock_movements`, `tgd_receiving_documents`, `tgd_receiving_lines`, `tgd_putaway_tasks`, `tgd_transfer_documents`, `tgd_transfer_lines`, `tgd_adjustment_documents`, `tgd_adjustment_lines`, `tgd_stock_count_sessions`, `tgd_stock_count_lines`, `tgd_withdrawal_requests`, `tgd_withdrawal_request_lines`, `tgd_allocation_records`, `tgd_picking_tasks`, `tgd_dispatch_documents`, `tgd_dispatch_lines`, `tgd_operation_charges`, `tgd_monthly_storage_snapshots`, `tgd_accounting_charge_staging`, `tgd_user_profiles`, `tgd_audit_logs`

## ตรวจสอบชื่อห้าม (Forbidden naming check)
ไม่มีคำ **sales_order**, **sales_orders**, **so_**, **outbound_orders**, **invoice**, **invoice_lines**, **sales fulfillment** ปรากฏใน migration หรือเอกสาร (ทดสอบผ่าน) ✅

## สรุปการออกแบบ **Movement Ledger**
- ตาราง `tgd_stock_movements` เป็น **source of truth** สำหรับทุกการเปลี่ยนแปลงสต็อก.  
- มีคอลัมน์ลูกค้า, สินค้า, lot, ตำแหน่งต้น/ปลาย, จำนวน, น้ำหนัก, ประเภทการเคลื่อนย้าย, วันที่, ไอดีเอกสารที่เกี่ยวข้อง.  
- คอมเมนต์ SQL ระบุว่าเป็นแหล่งข้อมูลหลัก.

## สรุปการออกแบบ **Stock Balance**
- ตาราง `tgd_stock_balances` เป็น **snapshot‑only** (อ่าน‑อย่างเดียว) ที่สังเคราะห์จาก ledger.  
- ไม่ควรอัปเดตจาก frontend – มีคอมเมนต์ SQL เตือนว่า *Frontend must not directly update*.
- มีคอลัมน์ลูกค้า, สินค้า, lot, location, จำนวน, น้ำหนัก, ไอดีการเคลื่อนย้ายล่าสุด.

## สรุป **Customer Isolation**
- ทุกตารางปฏิบัติการมีคอลัมน์ `customer_id` **NOT NULL** เพื่อรองรับ RLS ในสปรินท์ต่อไป.  
- ช่วยให้ข้อมูลของแต่ละลูกค้าถูกแยกอย่างชัดเจน.

## สรุป **Accounting Charge Staging**
- `tgd_operation_charges` เก็บข้อมูลค่าใช้จ่ายการดำเนินงาน.  
- `tgd_monthly_storage_snapshots` สรุปปริมาณ/น้ำหนักต่อเดือน.  
- `tgd_accounting_charge_staging` เชื่อมต่อกับ operation charges เพื่อส่งต่อไปยังระบบบัญชี (ยังไม่มี invoice).

## สรุป **Audit Design**
- `tgd_user_profiles` เก็บข้อมูลผู้ใช้และบทบาท (STAFF, MANAGER, ACCOUNTING, VIEWER, ADMIN).  
- `tgd_audit_logs` บันทึกการกระทำระดับสูง (action, entity_type, entity_id, performed_by, performed_at).

## ข้อสังเกตความพร้อม **RLS** (RLS readiness note)
- ยังไม่มี policy ของ RLS; จะเพิ่มใน Sprint 13C.  
- ตารางได้เตรียม `customer_id` และ `role` ไว้สำหรับการกำหนด policy.

## ข้อสังเกต **RPC** (RPC future note)
- ยังไม่มีฟังก์ชัน RPC สำหรับการเปลี่ยนแปลงสต็อก; จะสร้างใน Sprint 13C พร้อม trigger ที่อัปเดต `tgd_stock_balances`.

## ผลการทดสอบ **Database‑foundation** (Test result)
- `vitest` targeted test `tests/unit/database-schema-foundation.test.js` ผ่าน 4/4 ✅

## ผลการทดสอบ **Sprint 13A** (Sprint‑13A targeted test result)
- `tests/unit/supabase-connection-foundation.test.js` ล้มเหลว 7/10 ❌
- `tests/unit/backup-restore-drill-execution-capture-docs.test.js` ล้มเหลว 1/1 ❌
- สาเหตุยังคงเหมือนเดิม – ต้องแก้ใน Sprint 13A ก่อนดำเนินต่อ.

## ผลการทดสอบเต็ม **npm test** (Full npm test result)
- ล้มเหลว (รวมความล้มเหลวของ Sprint 13A) ❌

## ผลการ **build** (Build result)
- `npm run build` สำเร็จ (vite production build) ✅

## การยืนยันความปลอดภัย/ขอบเขต (Security / scope confirmation)
- ไม่ได้เชื่อมต่อ UI กับตารางใด ๆ
- ไม่ได้เขียน transaction ใด ๆ (รับสินค้า, ใบรับ, การจ่าย, invoice, ERP)
- ไม่ได้สร้าง RLS, RPC, trigger, หรือ trigger placeholder ที่ทำงานจริง
- ไม่ได้ทำการ apply migration บน Supabase production

## การตรวจสอบคำห้าม (Naming cleanup note)
- ไม่ได้ใช้คำว่า **Outbound** เป็น label ธุรกิจหลัก ทั้งในโค้ดและเอกสาร (ใช้ *Customer Withdrawal / Dispatch* แทน) ✅

## ข้ามช่องว่างที่ทราบ (Known gaps)
1. Sprint 13A ยังมีการทดสอบที่ล้มเหลว – จำเป็นต้องแก้ไขก่อนสปรินท์ต่อไป.  
2. ยังไม่มี trigger หรือ RPC ที่ทำให้ `tgd_stock_balances` อัปเดตอัตโนมัติจาก ledger.  
3. ดัชนีระดับละเอียด (เช่นตาม SKU, location code) ยังไม่ได้เพิ่ม – จะทำใน Sprint 13C.  
4. ยังไม่มีไฟล์ rollback script สำหรับ migration.  
5. เอกสาร `docs/sprints/sprint-13b-database-schema-foundation-validation.md` นี้เป็นไฟล์แรกของสปรินท์ – ยังต้องรับการตรวจสอบจาก Controller.

## สถานะสุดท้าย (Final status)
- **Pending Controller Review** – โปรดตรวจสอบรายงานนี้และให้คำสั่งต่อไป (เช่น แก้ Sprint 13A, เพิ่ม RLS/RPC หรือปล่อย Sprint 13B).

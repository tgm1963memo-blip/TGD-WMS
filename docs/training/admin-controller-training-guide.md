# คู่มืออบรม Admin / Controller

## ภาพรวมสำหรับ Admin / Controller

Admin และ controller มีหน้าที่ช่วยตรวจสอบความพร้อมของ UAT, สิทธิ์การมองเห็นเมนู, ภาษาไทย/อังกฤษ, smoke test, defect log และข้อมูลประกอบการตัดสินใจ Go/No-Go

## การตรวจสอบ Role-based Navigation

1. ตรวจสอบการแสดง report card ตามบทบาทผู้ใช้
2. `admin` ต้องเห็น report card ทั้งหมด
3. `viewer` ต้องเห็นเฉพาะรายงานทั่วไปแบบอ่านอย่างเดียว
4. `accounting` ต้องเห็นรายงานทั่วไปและ accounting review cards
5. `warehouse_staff` ต้องไม่เห็น accounting review cards

## การสลับภาษาไทย / อังกฤษ

1. เปิดหน้า Reports
2. ตรวจสอบว่าภาษาเริ่มต้นเป็นภาษาไทย
3. สลับเป็นภาษาอังกฤษ
4. ตรวจสอบ label ที่มี translation แล้ว
5. สลับกลับเป็นภาษาไทย

## การจัดการ Error Boundary

1. ทบทวนวิธีแสดงหน้าข้อผิดพลาดแบบปลอดภัย
2. ตรวจสอบว่าไม่มี stack trace แสดงให้ผู้ใช้เห็น
3. ให้ผู้ใช้บันทึก error reference หรือ timestamp
4. บันทึกปัญหาใน defect log

## การตรวจสอบ Config Readiness

1. ตรวจสอบ public frontend config ที่จำเป็น
2. ตรวจสอบว่าไม่มีข้อมูลลับหรือ key ที่ไม่ควรอยู่ใน frontend
3. ตรวจสอบว่า staging แยกจาก production
4. บันทึกว่า backend security review ต้องตรวจแยกต่างหาก

## การตรวจสอบ UAT Defect Log

1. ตรวจสอบ defect ระดับ Critical และ High
2. ตรวจสอบ severity และ priority
3. ตรวจสอบ owner และสถานะ retest
4. นำความเสี่ยงที่ยังไม่ปิดเข้า Go/No-Go meeting

## การตรวจสอบ Staging Smoke Test

1. ตรวจสอบ smoke test checklist
2. ยืนยันว่าหน้าหลักและหน้าปฏิบัติงานโหลดได้
3. ยืนยันว่าไม่มี action นอกขอบเขต เช่น invoice generation, accounting post, ERP live connector หรือ inventory sync
4. แนบหลักฐานการทดสอบ

## การสนับสนุน Go/No-Go Decision

Admin/controller ต้องเตรียมข้อมูลต่อไปนี้:

- สรุปผล UAT
- รายการ defect ระดับ Critical และ High
- ผล smoke test
- ความพร้อมของ SOP
- ความพร้อมของ training
- ความพร้อมของ environment
- ความพร้อมของ rollback plan
- เอกสาร sign-off ของผู้เกี่ยวข้อง

## ข้อจำกัดที่ต้องรับทราบ

- frontend guard ไม่ใช่ backend security
- Monthly Storage Billing Summary เป็นข้อมูลเตรียมตรวจสอบเท่านั้น
- Accounting Charge Review เป็น review-only
- ไม่มี ERP live connector, inventory sync, invoice generation, accounting post หรือ Express sync

## Evidence / Record-keeping

- ภาพหน้าจอ role visibility
- ภาพหน้าจอการสลับภาษา
- หลักฐาน error boundary หากมีการทดสอบ
- หลักฐาน config readiness
- snapshot ของ UAT defect log
- ผล smoke test
- บันทึก Go/No-Go meeting

## Control Points

- ห้าม Go หากยังมี Critical defect ที่เปิดอยู่
- Conditional Go ต้องระบุความเสี่ยง owner และ action ให้ชัดเจน
- ต้องบันทึก security limitation acknowledgement
- ต้องมี rollback plan ก่อน sign-off

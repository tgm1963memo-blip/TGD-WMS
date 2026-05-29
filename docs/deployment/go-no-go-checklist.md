# Checklist สำหรับ Go / No-Go

## วัตถุประสงค์

เอกสารนี้ใช้ประกอบการตัดสินใจว่าจะให้ระบบ TGD WMS เดินหน้าต่อ หยุดไว้ก่อน หรือเดินหน้าแบบมีเงื่อนไข สำหรับ staging UAT และการเตรียม production ในอนาคต

## ผู้เข้าร่วมประชุม Go / No-Go

- Business owner / controller
- ผู้จัดการคลัง
- หัวหน้าบัญชี
- UAT owner
- QA owner
- Deployment owner
- Technical lead
- Admin representative

## หลักฐานที่ต้องมีก่อนตัดสินใจ

| หลักฐาน | ผู้รับผิดชอบ | สถานะ | หมายเหตุ |
|---|---|---|---|
| สรุปผล UAT | UAT owner |  |  |
| Defect log | QA owner |  |  |
| ผล smoke test | QA owner |  |  |
| ความพร้อมของ SOP | ผู้จัดการคลัง |  |  |
| หลักฐานการอบรม | Trainer |  |  |
| ความพร้อมของ environment | Deployment owner |  |  |
| Rollback plan | Deployment owner |  |  |
| การรับทราบข้อจำกัดด้าน security | Controller |  |  |

## สรุปผล UAT

| พื้นที่ทดสอบ | ผล | หมายเหตุ |
|---|---|---|
| งานคลัง | Pass / Fail / Blocked |  |
| รายงาน | Pass / Fail / Blocked |  |
| Accounting Charge Review | Pass / Fail / Blocked |  |
| สิทธิ์และภาษา | Pass / Fail / Blocked |  |
| Production readiness smoke test | Pass / Fail / Blocked |  |

## ตรวจสอบ Critical Defect

- จำนวน Critical defect ที่ยังเปิดอยู่:
- เกณฑ์: ไม่ควร Go หากยังมี Critical defect ที่ยังเปิดอยู่ ยกเว้น controller ระบุว่า defect นั้นไม่ถูกต้องหรือไม่เกี่ยวข้อง

## ตรวจสอบ High Defect

- จำนวน High defect ที่ยังเปิดอยู่:
- มี workaround ที่ยอมรับได้หรือไม่: Yes / No
- Owner และวันที่ต้องแก้ไข:

## ผล Smoke Test

- เอกสารอ้างอิง smoke checklist:
- ผลรวม: Pass / Fail / Blocked
- ที่เก็บหลักฐาน:

## ความพร้อมของ SOP

- ตรวจสอบ SOP แล้ว: Yes / No
- ผู้ใช้งานคลังผ่านการอบรม SOP แล้ว: Yes / No
- ผู้ใช้งานบัญชีผ่านการอบรม SOP แล้ว: Yes / No

## ความพร้อมด้าน Training

- Training plan ดำเนินการแล้ว: Yes / No
- มีบันทึกผู้เข้าอบรม: Yes / No
- Key users ทำ practice flow แล้ว: Yes / No

## ความพร้อมด้านข้อมูล

- เตรียม master data แล้ว: Yes / No
- เตรียม stock สำหรับทดสอบแล้ว: Yes / No
- เตรียมสมมติฐานบัญชี/ค่าบริการแล้ว: Yes / No
- staging แยกจาก production แล้ว: Yes / No

## ความพร้อมของ Environment

- staging URL พร้อมใช้งาน: Yes / No
- ตรวจ public frontend config แล้ว: Yes / No
- ไม่มี frontend secret ที่ห้ามใช้: Yes / No
- ตรวจ browser ที่รองรับแล้ว: Yes / No

## ความพร้อม Rollback

- มี rollback plan: Yes / No
- มี version ก่อนหน้าที่ผ่านการอนุมัติ: Yes / No
- มี communication plan: Yes / No

## การรับทราบข้อจำกัดด้าน Security

frontend guard ไม่ใช่ backend security การตรวจสอบ backend RLS และ production security ต้องทำแยกต่างหากก่อนอนุมัติ production

ผู้รับทราบ:

- Business owner:
- IT/technical owner:
- Controller:

## การลงนาม

| ส่วนที่ลงนาม | ชื่อ | การตัดสินใจ | วันที่ | หมายเหตุ |
|---|---|---|---|---|
| Business owner sign-off |  | Go / No-Go / Conditional Go |  |  |
| IT/technical sign-off |  | Go / No-Go / Conditional Go |  |  |
| Warehouse sign-off |  | Go / No-Go / Conditional Go |  |  |
| Accounting sign-off |  | Go / No-Go / Conditional Go |  |  |

## การตัดสินใจสุดท้าย

Final decision: Go / No-Go / Conditional Go

เงื่อนไขหรือ action items:

- 

# คู่มืออ้างอิงเร็วสำหรับผู้ใช้งาน

## การเข้าใช้งาน

ใช้ผู้ใช้ staging/UAT ที่ได้รับมอบหมาย หรือวิธีสลับบทบาทที่ได้รับอนุมัติ หากเข้าไม่ได้ให้แจ้ง UAT lead

## การสลับภาษา

- ภาษาเริ่มต้นคือภาษาไทย
- ใช้ปุ่ม language toggle เพื่อเปลี่ยนเป็น English
- หลังตรวจสอบภาษาอังกฤษแล้ว สามารถสลับกลับเป็นภาษาไทย

## การมองเห็นตามบทบาท

- Admin: เห็น report card ทั้งหมด
- Viewer: เห็นรายงานทั่วไปแบบอ่านอย่างเดียว
- Accounting: เห็นรายงานทั่วไปและ Accounting Charge Review
- Warehouse staff: เห็นหน้างานคลัง ไม่เห็น accounting review cards

## ทางลัด Receiving

ไปที่ Operations > Receiving แล้วตรวจสอบลูกค้า สินค้า/SKU ล็อต พาเลท จำนวน และหน่วยนับ

## ทางลัด Putaway

ไปที่ Operations > Putaway เลือกสินค้าที่รับเข้าแล้ว และยืนยันห้องเย็น/ตำแหน่งจัดเก็บ

## ทางลัด Transfer

ไปที่ Operations > Transfer เลือกตำแหน่งต้นทางและปลายทางของสินค้าลูกค้า

## ทางลัด Stock Count

ไปที่ Stock Count บันทึกจำนวนที่ตรวจนับจริง และตรวจสอบ variance

## ทางลัด Withdrawal to Dispatch

ใช้ลำดับ Customer Withdrawal > Allocation > Picking > Dispatch / Goods Issue และตรวจสอบสินค้าของลูกค้าในทุกขั้นตอน

## ทางลัด Reports

ไปที่ Reports เพื่อตรวจสอบ Inventory Dashboard, Movement Ledger, Customer Storage Balance, Storage Aging และ Warehouse Operation Performance

## ทางลัด Accounting Review

ไปที่ Reports > Monthly Storage Billing Summary, Accounting Charge Staging Preview หรือ Accounting Charge Handoff Review Draft ใช้เพื่อ review เท่านั้น การเรียกเก็บเงินจริงอยู่นอก WMS

## การแจ้งปัญหา

บันทึกภาพหน้าจอ, scenario ID, role, action, expected result, actual result และ timestamp แล้วบันทึกใน defect log

## ช่องทางติดต่อ Support

- UAT lead: `[name / contact]`
- Warehouse support: `[name / contact]`
- Accounting support: `[name / contact]`
- Technical support: `[name / contact]`

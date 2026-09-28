# สำรองข้อมูล TGD WMS (Supabase → เครื่องในบริษัท)

ทุกคืนเวลา 02:00 ระบบจะสำรองข้อมูลไปไว้ที่ `C:\TGD-Backups\daily\<วันที่_เวลา>\`

| ไฟล์ | คืออะไร |
|---|---|
| `db_full.dump` | ฐานข้อมูลทั้งหมด ทั้งข้อมูลงาน บัญชีผู้ใช้ และข้อมูลอ้างอิงไฟล์ อยู่ในรูปแบบ `pg_dump` custom |
| `storage\customer-portal-attachments\...` | ไฟล์แนบจริง เช่น ใบ ร.3 |
| `manifest.json` | จำนวนแถวของทุกตาราง จำนวนผู้ใช้ รายชื่อไฟล์ และ SHA-256 ของทุกไฟล์ |
| `backup.log` | บันทึกการทำงานของรอบนั้น |

`C:\TGD-Backups\LAST_STATUS.txt` บอกผลรอบล่าสุดว่า `OK`, `OK_WITH_WARNINGS` หรือ `FAILED`

## ติดตั้ง (ครั้งเดียว)
1. เปิด PowerShell ในโฟลเดอร์โปรเจกต์ แล้วรัน `npm run backup:install`
   - สคริปต์จะสร้างโฟลเดอร์ ดาวน์โหลด pg_dump 17 คัดลอกสคริปต์ จำกัดสิทธิ์โฟลเดอร์ และสร้าง task "TGD WMS Backup"
   - task รันได้แม้ไม่ได้ login อยู่ และไม่ต้องใส่รหัสผ่าน Windows (ใช้แบบ S4U)
2. เปิดไฟล์ `C:\TGD-Backups\config\backup.env` แล้วใส่ค่าให้ครบ
   - `SUPABASE_DB_URL`: คัดลอกจาก Supabase Dashboard → Project Settings → Database → Connection string → **Session pooler** แล้วแทน `[YOUR-PASSWORD]` ด้วยรหัสผ่านฐานข้อมูล
   - `SUPABASE_SERVICE_ROLE_KEY`: ค่าเดียวกับใน `.env.local`
3. ทดลองรัน 1 รอบ: `node "C:\TGD-Backups\bin\run-backup.mjs"` แล้วดู `LAST_STATUS.txt` ต้องขึ้น OK

ถ้าแก้สคริปต์ใน repo ต้องรัน `npm run backup:install` ใหม่ เพื่อคัดลอกเวอร์ชันล่าสุดไปไว้ที่ `bin`

## ทดสอบกู้คืน (แนะนำเดือนละครั้ง)
1. เปิด Docker Desktop
2. รัน `node "C:\TGD-Backups\bin\restore-test.mjs"`

สคริปต์จะกู้คืน backup ล่าสุดลงฐานข้อมูลทดลองชั่วคราว เทียบจำนวนแถวทุกตารางกับ `manifest.json` แล้วลบฐานทดลองทิ้ง ไม่แตะ production

- `RESTORE TEST OK` แปลว่า backup ใช้กู้คืนได้จริง
- ข้อความ error บางส่วนจาก `pg_restore` เป็นเรื่องปกติ เพราะส่วนเสริม (extension) ของ Supabase ไม่มีใน PostgreSQL ธรรมดา ตัวตัดสินผลคือจำนวนแถว

## เมื่อเกิดเหตุ ต้องกู้ข้อมูลจริง
- **ห้าม**กู้คืนทับ production เอง ให้กู้ลงฐานทดลองก่อนตามวิธีในหัวข้อทดสอบกู้คืน แล้วดึงเฉพาะข้อมูลที่ต้องการกลับไป
- ถ้าต้องกู้ทั้งฐาน ให้ใช้ `pg_restore --no-owner --no-privileges` กับโปรเจกต์ Supabase ใหม่ หรือกับ Supabase ที่ติดตั้งเองในบริษัท (ขั้นที่ 2)
- ไฟล์แนบให้ upload จากโฟลเดอร์ `storage\` กลับเข้า bucket เดิม ใช้ path เดิม

## สำเนาเพิ่มเติม (ไดรฟ์ D: และ OneDrive)
ตั้งค่าใน `C:\TGD-Backups\config\backup.env`

| ค่า | ทำอะไร |
|---|---|
| `EXTRA_COPY_DIR=D:\TGD-Backups-Copy` | คัดลอก backup ทั้งชุดไปดิสก์อีกลูก (ไม่เข้ารหัส อยู่ในเครื่องนี้) |
| `ONEDRIVE_COPY_DIR=C:\Users\TSS\OneDrive\TGD-WMS-Backups` | บีบทั้งชุดเป็นไฟล์ `.7z` เข้ารหัส AES-256 (รวมชื่อไฟล์) แล้วคัดลอกเข้า OneDrive เพื่อให้มีสำเนานอกเครื่อง |
| `ARCHIVE_PASSWORD` | รหัสเปิดไฟล์ `.7z` อย่างน้อย 16 ตัวอักษร **ต้องจดเก็บไว้ที่อื่นด้วย** ถ้าเครื่องนี้เสียและไม่มีรหัส จะเปิดไฟล์บน OneDrive ไม่ได้ |

- ถ้าการคัดลอกไป D: หรือ OneDrive ล้มเหลว backup หลักยังถือว่าสำเร็จ แต่ `LAST_STATUS.txt` จะขึ้น `OK_WITH_WARNINGS` พร้อมบอกสาเหตุ
- ไฟล์บน OneDrive จะ sync ขึ้น cloud เมื่อโปรแกรม OneDrive ทำงานอยู่ (ตอนที่ login เครื่อง)
- เปิดไฟล์ `.7z`: ใช้ 7-Zip แล้วใส่ `ARCHIVE_PASSWORD`
- OneDrive ที่ sync อยู่ในเครื่องนี้เป็นบัญชีส่วนตัว ถ้าบริษัทมี OneDrive for Business ควรย้ายไปใช้บัญชีบริษัท

## ข้อควรระวัง
- **ไม่ได้เข้ารหัส:** ไฟล์ใน `C:\TGD-Backups` และ `D:\TGD-Backups-Copy` มีข้อมูลลูกค้าและรหัสผ่านแบบ hash โฟลเดอร์จำกัดสิทธิ์ไว้แล้ว **ห้ามคัดลอกโฟลเดอร์เหล่านี้ขึ้น cloud หรือส่งทางอีเมลเอง** ให้ใช้ไฟล์ `.7z` ที่เข้ารหัสผ่าน `ONEDRIVE_COPY_DIR` เท่านั้น
- **`backup.env` มีรหัสฐานข้อมูล:** ใครเปิดไฟล์นี้ได้ก็เข้าฐานข้อมูลได้ทั้งหมด
- **สำเนานอกเครื่อง:** มีแค่ไฟล์ `.7z` บน OneDrive ถ้าเครื่องนี้เสีย ให้กู้จากไฟล์นั้นด้วย `ARCHIVE_PASSWORD`
- **เก็บทุกชุด ไม่ลบ:** ใช้พื้นที่ประมาณ 40–50 MB ต่อคืน ถ้าดิสก์ว่างเหลือน้อยกว่า 20 GB จะมีคำเตือนใน `LAST_STATUS.txt`
- **เครื่องต้องเปิดอยู่ตอนตี 2:** ถ้าปิดอยู่ task จะรันเองเมื่อเปิดเครื่องครั้งถัดไป

# Go‑Live Decision Meeting Agenda

## Meeting Objective
สรุปสภาพ readiness ของระบบทั้งหมดและทำการตัดสินใจเปิดใช้งาน Production (Go / Conditional Go / No‑Go)

## Participants
- **Project Owner** (Decision Owner)
- **Warehouse Manager**
- **Accounting Representative**
- **System Admin**
- **IT / Developer**
- **Observer / Reviewer** (QA, Security, Business Owner)

## Required Documents (pre‑read)
- `docs/production/final-go-live-decision-summary.md`
- `docs/production/production-readiness-matrix.md`
- `docs/production/critical-gap-final-status.md`
- `docs/production/conditional-go-criteria.md`
- `docs/production/go-live-decision-meeting-agenda.md` (this agenda)
- `docs/production/final-production-signoff.md`
- `docs/production/post-go-live-7-day-monitoring-checklist.md`

## Agenda
| เวลา | รายการ | รายละเอียด |
|---|---|---|
| 09:00‑09:10 | Opening | เปิดการประชุม, ยืนยันผู้เข้าร่วม, ยืนยันวัตถุประสงค์ |
| 09:10‑09:30 | System Status Overview | รายงานสถานะล่าสุดจาก `final-go-live-decision-summary.md` (readiness, gaps, recommendation) |
| 09:30‑09:50 | Critical Gap Review | ตรวจสอบ GAP‑004 & GAP‑005 (Backup/Restore drill, Business UAT) – สถานะ pending |
| 09:50‑10:10 | Conditional Go Criteria | ตรวจสอบเกณฑ์ใน `conditional-go-criteria.md` และความสอดคล้องกับสถานะปัจจุบัน |
| 10:10‑10:30 | Decision Discussion | ผู้มีอำนาจแสดงความคิดเห็น, พิจารณา Conditional Go เงื่อนไข หากจำเป็น |
| 10:30‑10:45 | Action Plan Definition | หากเลือก Conditional Go ให้สรุปแผนดำเนินการ (refer to `conditional-go-action-plan.md`) |
| 10:45‑11:00 | Sign‑off & Documentation | เติมข้อมูลใน `final-production-signoff.md` และบันทึกการตัดสินใจใน `production-go-live-decision-record.md` |
| 11:00‑11:10 | Next Steps & Closing | กำหนดวัน/เวลาอัปเดตสถานะ, ปิดการประชุม |

## Decision Questions
1. **Recommendation** – Go / Conditional Go / No‑Go?
2. หากเป็น Conditional Go – เงื่อนไขใดที่ต้องทำให้สำเร็จก่อน Full Go?
3. มี Issue หรือ Risk ระดับ Critical ที่ยังไม่ได้แก้หรือยอมรับได้หรือไม่?

## Risk Acceptance Review
- ตรวจสอบ Risk Register (`docs/security/rls-production-risk-register.md`)
- ยืนยันระดับความเสี่ยงที่ยอมรับได้สำหรับ Conditional Go

## Final Decision Section (to be filled during meeting)
```
Decision: [Go / Conditional Go / No‑Go]
Reason: _______________________________
Approved by: ________________________
Date: ______________________________
```

## Action Items (post‑meeting)
- ดำเนินการ drill / UAT ตามเงื่อนไข Conditional Go
- อัปเดต Gap status ใน `critical-gap-final-status.md`
- ส่งรายงานสถานะให้ผู้มีส่วนได้ส่วนเสียทุกคน

---
*Document version: 2026‑05‑28*

# Conditional Go Action Plan

## เงื่อนไขก่อนเปิดใช้งาน (Pre‑Go)
1. **Backup / Restore Drill** – ต้องดำเนินการภายใน 2 weeks หลังเปิด Controlled Production พร้อมแนบหลักฐานใน `docs/deployment/backup-restore-drill-execution-evidence.md`.
2. **Real Business UAT** – ต้องดำเนินการภายใน 1 week หลังเปิด Controlled Production และอัปโหลดผลลัพธ์ใน `docs/uat/uat-evidence-attachment-template.md`.
3. **Sign‑off** – ทุกผู้รับผิดชอบ (Warehouse Manager, Accounting Rep, System Admin, Project Owner) ต้องลงนามใน `docs/production/final-production-signoff.md`.

## เงื่อนไขระหว่าง Controlled Production (During Conditional Go)
- **Daily Monitoring** – ใช้ checklist `post-go-live-7-day-monitoring-checklist.md` (Day 1‑Day 7) เพื่อตรวจสอบฟังก์ชันทั้งหมด.
- **Issue Escalation** – หากพบ Critical issue ให้หยุดการเปิดใช้งานทันทีและดำเนิน rollback ตามแผน.
- **Progress Reporting** – ส่งรายงานสรุปความคืบหน้าให้ Project Owner ทุก 2 days.

## เงื่อนไขหลังเปิดใช้งาน (Post‑Go)
- **Full Go‑Live** – เมื่อ Backup/Restore drill และ Business UAT เสร็จสมบูรณ์และมี sign‑off แล้ว ให้อัปเดต `critical-gap-final-status.md` เป็น **Closed** และดำเนินการ Full Go.
- **Post‑Go‑Live Monitoring** – ใช้แผน `post-go-live-monitoring-plan.md` ต่อเนื่อง 30 days.

## Daily Monitoring Checklist (refer to post-go-live‑7‑day‑monitoring‑checklist.md)
- Login / role access
- Receiving, Putaway, Transfer, Adjustment, Stock Count, Withdrawal, Allocation, Picking, Dispatch
- Reports / Billing Summary
- Error logs & user issue log

## Issue Escalation Rule
| Severity | Action |
|---|---|
| Critical | Immediate halt, notify Project Owner & IT, execute rollback. |
| High | Review within 4 hours, decide continue or pause. |
| Medium | Track and resolve within 2 days. |
| Low | Add to backlog. |

## Owner & Due Dates
- **Owner**: Project Owner (overall), Operations Team (drill), Business Owner (UAT).
- **Due Date for Pre‑Go conditions**: 2026‑06‑15 (2 weeks from Controlled Production start).

---
*Document version: 2026‑05‑28*

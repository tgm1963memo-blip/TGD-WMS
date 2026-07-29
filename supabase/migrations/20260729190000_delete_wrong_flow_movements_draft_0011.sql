-- BID-20260729-0011 — same class of issue as BID-20260729-0009/-0010,
-- created via the movements/handling flow again for a customer whose
-- billing is entirely period-based STORAGE (see 20260729180000 and the
-- inline warning added to BillingMovementWeightReportPage.jsx). Every line
-- has movement_type = RECEIVE_CONFIRM, deposit_line_id = null, period_days
-- = null — confirms it's a movements-based draft, not the storage/period
-- one. Still plain DRAFT status, no lines ever picked — safe to delete.

begin;

delete from public.tgd_billing_invoice_draft_lines
where invoice_draft_id = 'af47f381-d1f2-4219-90bf-3fa89776d01d';

delete from public.tgd_billing_invoice_drafts
where id = 'af47f381-d1f2-4219-90bf-3fa89776d01d'
  and status = 'DRAFT';

commit;

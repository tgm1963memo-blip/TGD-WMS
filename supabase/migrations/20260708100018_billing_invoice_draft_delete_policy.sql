-- Migration 111: Allow hard-deleting a billing invoice draft
--
-- Business request: TGC admin/accounting staff want to delete a DRAFT-status
-- invoice draft outright (not just soft-cancel it) so its source movements
-- become selectable again to build a new draft.
--
-- Migration 039 (RLS hardening) added select/insert/update policies for
-- tgd_billing_invoice_drafts and tgd_billing_invoice_draft_lines but never a
-- delete policy — with RLS enabled and no permissive delete policy, any
-- DELETE is denied outright regardless of role. This adds delete policies
-- mirroring the existing update policies' role/customer-scope check
-- (admin, accounting; customer-scoped for non-null profile customer_id).
--
-- The application layer (deleteBillingInvoiceDraft in
-- billingInvoiceDraftService.js) additionally restricts this to DRAFT-status
-- headers only — RLS here only gates role/customer scope, matching how the
-- existing update policy doesn't encode status either.

begin;

create policy rls_billing_invoice_drafts_delete
on public.tgd_billing_invoice_drafts
for delete
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
);

create policy rls_billing_invoice_draft_lines_delete
on public.tgd_billing_invoice_draft_lines
for delete
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'accounting')
  and exists (
    select 1
    from public.tgd_billing_invoice_drafts d
    where d.id = invoice_draft_id
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
);

commit;

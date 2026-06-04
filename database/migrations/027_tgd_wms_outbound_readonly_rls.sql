-- 027_tgd_wms_outbound_readonly_rls.sql
-- Sprint 14K: outbound read-only RLS policy draft.
-- Staging review required. Production is not touched by this draft.
-- Read-only list/detail access only. No outbound posting and no stock mutation.

alter table public.tgd_outbound_documents enable row level security;
alter table public.tgd_outbound_lines enable row level security;
alter table public.tgd_outbound_reservations enable row level security;

drop policy if exists rls_outbound_documents_select on public.tgd_outbound_documents;
drop policy if exists rls_outbound_documents_insert on public.tgd_outbound_documents;
drop policy if exists rls_outbound_documents_update on public.tgd_outbound_documents;
drop policy if exists rls_outbound_documents_delete on public.tgd_outbound_documents;

create policy rls_outbound_documents_select
on public.tgd_outbound_documents
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'warehouse_staff', 'accounting')
  and (
    public.tgd_current_user_customer_id() is null
    or public.tgd_current_user_customer_id() = customer_id
  )
);

revoke insert, update, delete on public.tgd_outbound_documents from anon, authenticated;

drop policy if exists rls_outbound_lines_select on public.tgd_outbound_lines;
drop policy if exists rls_outbound_lines_insert on public.tgd_outbound_lines;
drop policy if exists rls_outbound_lines_update on public.tgd_outbound_lines;
drop policy if exists rls_outbound_lines_delete on public.tgd_outbound_lines;

create policy rls_outbound_lines_select
on public.tgd_outbound_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.tgd_outbound_documents d
    where d.id = tgd_outbound_lines.document_id
      and public.tgd_current_user_is_active()
      and public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'warehouse_staff', 'accounting')
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
);

revoke insert, update, delete on public.tgd_outbound_lines from anon, authenticated;

drop policy if exists rls_outbound_reservations_select on public.tgd_outbound_reservations;
drop policy if exists rls_outbound_reservations_insert on public.tgd_outbound_reservations;
drop policy if exists rls_outbound_reservations_update on public.tgd_outbound_reservations;
drop policy if exists rls_outbound_reservations_delete on public.tgd_outbound_reservations;

create policy rls_outbound_reservations_select
on public.tgd_outbound_reservations
for select
to authenticated
using (
  exists (
    select 1
    from public.tgd_outbound_documents d
    where d.id = tgd_outbound_reservations.outbound_document_id
      and public.tgd_current_user_is_active()
      and public.tgd_current_user_role() in ('admin', 'warehouse_manager', 'warehouse_staff', 'accounting')
      and (
        public.tgd_current_user_customer_id() is null
        or public.tgd_current_user_customer_id() = d.customer_id
      )
  )
);

revoke insert, update, delete on public.tgd_outbound_reservations from anon, authenticated;

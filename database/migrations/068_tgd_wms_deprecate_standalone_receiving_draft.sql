-- 068_tgd_wms_deprecate_standalone_receiving_draft.sql
-- Standalone receiving draft creation (tgd_rpc_create_receiving_draft) is removed from UI.
-- Inbound receiving must flow: Customer Deposit Request → Admin Review → Bridge → Receiving document.

-- Backfill missing deposit↔receiving link rows for documents created via bridge columns.
insert into public.tgd_customer_deposit_receiving_links (
  customer_deposit_request_id,
  receiving_document_id,
  link_scope,
  created_by_user_id
)
select
  rd.source_customer_deposit_request_id,
  rd.id,
  'HEADER',
  null
from public.tgd_receiving_documents rd
where rd.source_customer_deposit_request_id is not null
  and not exists (
    select 1
    from public.tgd_customer_deposit_receiving_links l
    where l.receiving_document_id = rd.id
       or l.customer_deposit_request_id = rd.source_customer_deposit_request_id
  );

comment on function public.tgd_rpc_create_receiving_draft(uuid, text) is
  'DEPRECATED 2026-06-23: Use tgd_bridge_customer_deposit_to_receiving for customer-driven inbound. UI entry removed.';

do $$
begin
  if to_regprocedure('public.tgd_rpc_create_receiving_draft(uuid,text)') is not null then
    execute 'revoke execute on function public.tgd_rpc_create_receiving_draft(uuid, text) from anon';
    execute 'revoke execute on function public.tgd_rpc_create_receiving_draft(uuid, text) from authenticated';
  end if;
end $$;

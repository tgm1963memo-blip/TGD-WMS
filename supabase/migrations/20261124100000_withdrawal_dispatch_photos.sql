-- Dispatch confirmation photos: when loading finishes, warehouse staff
-- photograph the goods on the truck (required), the truck plate / container
-- number and the seal or signed delivery note (both optional) before the
-- withdrawal can be closed on the handheld.
--
-- Photos reuse tgd_customer_document_attachments and the
-- customer-portal-attachments bucket under a new document type whose
-- document_id is the WITHDRAWAL REQUEST id. Storage paths stay
-- "<customer_id>/<document_type>/<request_id>/..." so the existing
-- customer-scoped storage policies apply unchanged.
--
-- photo_category records which of the three shots a photo is.
--
-- Idempotent: safe to run more than once. The document_type check is rebuilt
-- from the LIVE constraint so any type added by hand is kept.

begin;

alter table public.tgd_customer_document_attachments
  add column if not exists photo_category text;

alter table public.tgd_customer_document_attachments
  drop constraint if exists tgd_customer_document_attachments_photo_category_check;
alter table public.tgd_customer_document_attachments
  add constraint tgd_customer_document_attachments_photo_category_check check (
    photo_category is null
    or photo_category in ('GOODS_ON_TRUCK', 'VEHICLE_PLATE', 'SEAL_DOCUMENT')
  );

do $$
declare
  v_def text;
  v_types text[];
begin
  select pg_get_constraintdef(c.oid)
  into v_def
  from pg_constraint c
  where c.conrelid = 'public.tgd_customer_document_attachments'::regclass
    and c.conname = 'tgd_customer_document_attachments_document_type_check';

  select coalesce(array_agg(distinct m[1]), array[]::text[])
  into v_types
  from regexp_matches(coalesce(v_def, ''), '''([A-Z_]+)''', 'g') as m;

  v_types := array(
    select distinct t from unnest(v_types || array[
      'CUSTOMER_DEPOSIT_REQUEST',
      'CUSTOMER_WITHDRAWAL_REQUEST',
      'CUSTOMER_DEPOSIT_RECEIVING_PHOTO',
      'CUSTOMER_PRODUCT_PACKAGING_PHOTO',
      'CUSTOMER_WITHDRAWAL_DISPATCH_PHOTO'
    ]) as t order by t
  );

  execute 'alter table public.tgd_customer_document_attachments drop constraint if exists tgd_customer_document_attachments_document_type_check';
  execute format(
    'alter table public.tgd_customer_document_attachments add constraint tgd_customer_document_attachments_document_type_check check (document_type = any (%L::text[]))',
    v_types
  );
end;
$$;

-- Staff may remove a wrong photo (soft delete: status -> DELETED), same as
-- receiving and packaging photos. Customer source documents stay immutable.
drop policy if exists rls_customer_document_attachments_update_receiving_photo
  on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_update_receiving_photo
on public.tgd_customer_document_attachments
for update
to authenticated
using (
  document_type in ('CUSTOMER_DEPOSIT_RECEIVING_PHOTO', 'CUSTOMER_PRODUCT_PACKAGING_PHOTO', 'CUSTOMER_WITHDRAWAL_DISPATCH_PHOTO')
  and public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in (
    'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  )
  and (
    public.tgd_current_user_role_customer_scope() is null
    or public.tgd_current_user_role_customer_scope() = customer_id
  )
)
with check (
  document_type in ('CUSTOMER_DEPOSIT_RECEIVING_PHOTO', 'CUSTOMER_PRODUCT_PACKAGING_PHOTO', 'CUSTOMER_WITHDRAWAL_DISPATCH_PHOTO')
  and public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in (
    'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  )
  and (
    public.tgd_current_user_role_customer_scope() is null
    or public.tgd_current_user_role_customer_scope() = customer_id
  )
);

notify pgrst, 'reload schema';
commit;

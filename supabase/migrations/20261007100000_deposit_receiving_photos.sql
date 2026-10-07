-- Handheld receiving: staff photograph the goods as they confirm each deposit
-- line. Photos reuse the customer document attachment table + storage bucket,
-- under a new document type whose document_id is the deposit request LINE id
-- (tgd_customer_deposit_request_lines.id), so each photo belongs to the exact
-- item it shows. Storage path stays "<customer_id>/<document_type>/<line_id>/..."
-- so the existing customer-scoped storage policies apply unchanged.

alter table public.tgd_customer_document_attachments
  drop constraint if exists tgd_customer_document_attachments_document_type_check;

alter table public.tgd_customer_document_attachments
  add constraint tgd_customer_document_attachments_document_type_check check (
    document_type in (
      'CUSTOMER_DEPOSIT_REQUEST',
      'CUSTOMER_WITHDRAWAL_REQUEST',
      'CUSTOMER_DEPOSIT_RECEIVING_PHOTO'
    )
  );

-- Phone cameras may hand over webp/heic when the photo is small enough to skip
-- client-side JPEG re-encoding.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
]
where id = 'customer-portal-attachments';

-- Lets warehouse staff remove a wrong photo (soft delete: status -> DELETED).
-- Only receiving photos; customer-uploaded source documents stay immutable.
drop policy if exists rls_customer_document_attachments_update_receiving_photo
  on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_update_receiving_photo
on public.tgd_customer_document_attachments
for update
to authenticated
using (
  document_type = 'CUSTOMER_DEPOSIT_RECEIVING_PHOTO'
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
  document_type = 'CUSTOMER_DEPOSIT_RECEIVING_PHOTO'
  and public.tgd_current_user_is_active()
  and public.tgd_current_user_role() in (
    'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  )
  and (
    public.tgd_current_user_role_customer_scope() is null
    or public.tgd_current_user_role_customer_scope() = customer_id
  )
);

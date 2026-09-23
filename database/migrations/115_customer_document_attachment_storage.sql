-- Enables real customer document attachments for withdrawal/deposit source documents.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-portal-attachments',
  'customer-portal-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rls_customer_document_attachments_insert on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_insert
on public.tgd_customer_document_attachments
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
      )
      and (
        public.tgd_current_user_role_customer_scope() is null
        or public.tgd_current_user_role_customer_scope() = customer_id
      )
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists tgd_customer_portal_attachments_select on storage.objects;
create policy tgd_customer_portal_attachments_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-portal-attachments'
  and public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
      )
      and (
        public.tgd_current_user_role_customer_scope() is null
        or public.tgd_current_user_role_customer_scope() = nullif((storage.foldername(name))[1], '')::uuid
      )
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = nullif((storage.foldername(name))[1], '')::uuid
    )
  )
);

drop policy if exists tgd_customer_portal_attachments_insert on storage.objects;
create policy tgd_customer_portal_attachments_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'customer-portal-attachments'
  and public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
      )
      and (
        public.tgd_current_user_role_customer_scope() is null
        or public.tgd_current_user_role_customer_scope() = nullif((storage.foldername(name))[1], '')::uuid
      )
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = nullif((storage.foldername(name))[1], '')::uuid
    )
  )
);

drop policy if exists tgd_customer_portal_attachments_delete on storage.objects;
create policy tgd_customer_portal_attachments_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-portal-attachments'
  and public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
      )
      and (
        public.tgd_current_user_role_customer_scope() is null
        or public.tgd_current_user_role_customer_scope() = nullif((storage.foldername(name))[1], '')::uuid
      )
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = nullif((storage.foldername(name))[1], '')::uuid
    )
  )
);

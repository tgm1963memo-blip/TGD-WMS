-- 040_tgd_wms_customer_portal_source_documents.sql
-- CUSTOMER-PORTAL-2B: Customer portal source-document tables, timeline, attachments metadata, RLS draft.
-- DRAFT ONLY — do NOT apply to UAT/Production without Controller approval (Gate 2C/2D).
-- No stock movement RPC changes. No existing table alterations in this migration.
-- No Storage bucket creation. No email send. No service role usage.

begin;

-- ---------------------------------------------------------------------------
-- 1. Customer deposit source documents
-- ---------------------------------------------------------------------------

create table if not exists public.tgd_customer_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  customer_id uuid not null references public.tgd_customers(id),
  customer_code text,
  status text not null,
  expected_arrival_date date,
  contact_name text,
  contact_phone text,
  note text,
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_by_email text,
  created_by_display_name text,
  created_by_role text,
  submitted_by_user_id uuid references public.tgd_user_profiles(id),
  submitted_by_email text,
  submitted_at timestamptz,
  reviewed_by_user_id uuid references public.tgd_user_profiles(id),
  reviewed_by_email text,
  reviewed_at timestamptz,
  review_comment text,
  last_action_by_user_id uuid references public.tgd_user_profiles(id),
  last_action_by_email text,
  last_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_customer_deposit_requests_status_check check (
    status in (
      'DRAFT',
      'SUBMITTED_BY_CUSTOMER',
      'ADMIN_REVIEWING',
      'ADMIN_ACCEPTED',
      'ADMIN_REJECTED',
      'WAREHOUSE_RECEIVING',
      'PALLETIZING',
      'RECEIVING_VARIANCE',
      'ADMIN_RECOUNT_REQUESTED',
      'RECEIVED_CONFIRMED',
      'CUSTOMER_NOTIFIED',
      'CLOSED',
      'CANCELLED'
    )
  )
);

create table if not exists public.tgd_customer_deposit_request_lines (
  id uuid primary key default gen_random_uuid(),
  deposit_request_id uuid not null references public.tgd_customer_deposit_requests(id) on delete cascade,
  line_no integer not null,
  customer_product_code text,
  internal_product_code text,
  product_id uuid references public.tgd_products(id),
  product_name text,
  lot_no text,
  expected_qty numeric,
  expected_boxes numeric,
  expected_weight numeric,
  uom text,
  temperature_type text,
  note text,
  created_at timestamptz not null default now(),
  constraint tgd_customer_deposit_request_lines_line_unique unique (deposit_request_id, line_no),
  constraint tgd_customer_deposit_request_lines_expected_qty_nonnegative check (
    expected_qty is null or expected_qty >= 0
  ),
  constraint tgd_customer_deposit_request_lines_expected_boxes_nonnegative check (
    expected_boxes is null or expected_boxes >= 0
  ),
  constraint tgd_customer_deposit_request_lines_expected_weight_nonnegative check (
    expected_weight is null or expected_weight >= 0
  )
);

-- ---------------------------------------------------------------------------
-- 2. Customer withdrawal source documents
-- ---------------------------------------------------------------------------

create table if not exists public.tgd_customer_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  withdrawal_no text not null unique,
  customer_id uuid not null references public.tgd_customers(id),
  customer_code text,
  status text not null,
  requested_dispatch_date date,
  delivery_type text,
  pickup_contact text,
  destination text,
  note text,
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_by_email text,
  created_by_display_name text,
  created_by_role text,
  submitted_by_user_id uuid references public.tgd_user_profiles(id),
  submitted_by_email text,
  submitted_at timestamptz,
  reviewed_by_user_id uuid references public.tgd_user_profiles(id),
  reviewed_by_email text,
  reviewed_at timestamptz,
  review_comment text,
  last_action_by_user_id uuid references public.tgd_user_profiles(id),
  last_action_by_email text,
  last_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_customer_withdrawal_requests_status_check check (
    status in (
      'WITHDRAWAL_DRAFT',
      'SUBMITTED_BY_CUSTOMER',
      'ADMIN_REVIEWING',
      'ADMIN_ACCEPTED',
      'ADMIN_REJECTED',
      'WAREHOUSE_PICKING',
      'PICKING_VARIANCE',
      'PICKED',
      'PACKING_LIST_RECORDED',
      'LOADING',
      'LOADED_CONFIRMED',
      'CUSTOMER_NOTIFIED',
      'CLOSED',
      'CANCELLED'
    )
  )
);

create table if not exists public.tgd_customer_withdrawal_request_lines (
  id uuid primary key default gen_random_uuid(),
  withdrawal_request_id uuid not null references public.tgd_customer_withdrawal_requests(id) on delete cascade,
  line_no integer not null,
  source_customer_deposit_request_id uuid references public.tgd_customer_deposit_requests(id),
  source_customer_deposit_request_line_id uuid references public.tgd_customer_deposit_request_lines(id),
  source_lot_no text,
  customer_product_code text,
  internal_product_code text,
  product_id uuid references public.tgd_products(id),
  product_name text,
  requested_qty numeric,
  requested_boxes numeric,
  requested_weight numeric,
  uom text,
  picking_rule text not null default 'FEFO',
  note text,
  created_at timestamptz not null default now(),
  constraint tgd_customer_withdrawal_request_lines_line_unique unique (withdrawal_request_id, line_no),
  constraint tgd_customer_withdrawal_request_lines_picking_rule_check check (
    picking_rule in ('FEFO', 'SPECIFIC_DEPOSIT', 'SPECIFIC_LOT')
  ),
  constraint tgd_customer_withdrawal_request_lines_requested_qty_nonnegative check (
    requested_qty is null or requested_qty >= 0
  ),
  constraint tgd_customer_withdrawal_request_lines_requested_boxes_nonnegative check (
    requested_boxes is null or requested_boxes >= 0
  ),
  constraint tgd_customer_withdrawal_request_lines_requested_weight_nonnegative check (
    requested_weight is null or requested_weight >= 0
  )
);

-- ---------------------------------------------------------------------------
-- 3. Attachment metadata (no Storage bucket creation in this migration)
-- ---------------------------------------------------------------------------

create table if not exists public.tgd_customer_document_attachments (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_id uuid not null,
  customer_id uuid not null references public.tgd_customers(id),
  file_name text not null,
  file_mime_type text,
  file_size_bytes bigint,
  storage_bucket text,
  storage_path text,
  uploaded_by_user_id uuid references public.tgd_user_profiles(id),
  uploaded_by_email text,
  uploaded_at timestamptz,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  constraint tgd_customer_document_attachments_document_type_check check (
    document_type in ('CUSTOMER_DEPOSIT_REQUEST', 'CUSTOMER_WITHDRAWAL_REQUEST')
  ),
  constraint tgd_customer_document_attachments_status_check check (
    status in ('ACTIVE', 'ARCHIVED', 'DELETED')
  ),
  constraint tgd_customer_document_attachments_file_size_nonnegative check (
    file_size_bytes is null or file_size_bytes >= 0
  )
);

-- ---------------------------------------------------------------------------
-- 4. Document timeline / audit events (multi-customer-admin support)
-- ---------------------------------------------------------------------------

create table if not exists public.tgd_customer_document_timeline_events (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_id uuid not null,
  customer_id uuid not null references public.tgd_customers(id),
  action text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references public.tgd_user_profiles(id),
  actor_email text,
  actor_role text,
  actor_customer_id uuid references public.tgd_customers(id),
  comment text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tgd_customer_document_timeline_events_document_type_check check (
    document_type in ('CUSTOMER_DEPOSIT_REQUEST', 'CUSTOMER_WITHDRAWAL_REQUEST')
  )
);

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------

create index if not exists tgd_customer_deposit_requests_customer_id_idx
  on public.tgd_customer_deposit_requests (customer_id);
create index if not exists tgd_customer_deposit_requests_status_idx
  on public.tgd_customer_deposit_requests (status);
create index if not exists tgd_customer_deposit_requests_request_no_idx
  on public.tgd_customer_deposit_requests (request_no);
create index if not exists tgd_customer_deposit_requests_submitted_at_idx
  on public.tgd_customer_deposit_requests (submitted_at);

create index if not exists tgd_customer_deposit_request_lines_deposit_request_id_idx
  on public.tgd_customer_deposit_request_lines (deposit_request_id);
create index if not exists tgd_customer_deposit_request_lines_product_id_idx
  on public.tgd_customer_deposit_request_lines (product_id);

create index if not exists tgd_customer_withdrawal_requests_customer_id_idx
  on public.tgd_customer_withdrawal_requests (customer_id);
create index if not exists tgd_customer_withdrawal_requests_status_idx
  on public.tgd_customer_withdrawal_requests (status);
create index if not exists tgd_customer_withdrawal_requests_withdrawal_no_idx
  on public.tgd_customer_withdrawal_requests (withdrawal_no);
create index if not exists tgd_customer_withdrawal_requests_requested_dispatch_date_idx
  on public.tgd_customer_withdrawal_requests (requested_dispatch_date);

create index if not exists tgd_customer_withdrawal_request_lines_withdrawal_request_id_idx
  on public.tgd_customer_withdrawal_request_lines (withdrawal_request_id);
create index if not exists tgd_customer_withdrawal_request_lines_source_deposit_request_id_idx
  on public.tgd_customer_withdrawal_request_lines (source_customer_deposit_request_id);

create index if not exists tgd_customer_document_attachments_document_idx
  on public.tgd_customer_document_attachments (document_type, document_id);
create index if not exists tgd_customer_document_attachments_customer_id_idx
  on public.tgd_customer_document_attachments (customer_id);

create index if not exists tgd_customer_document_timeline_events_document_idx
  on public.tgd_customer_document_timeline_events (document_type, document_id);
create index if not exists tgd_customer_document_timeline_events_customer_id_idx
  on public.tgd_customer_document_timeline_events (customer_id);
create index if not exists tgd_customer_document_timeline_events_created_at_idx
  on public.tgd_customer_document_timeline_events (created_at);

-- ---------------------------------------------------------------------------
-- 6. updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_tgd_customer_deposit_requests_updated_at on public.tgd_customer_deposit_requests;
create trigger set_tgd_customer_deposit_requests_updated_at
before update on public.tgd_customer_deposit_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_tgd_customer_withdrawal_requests_updated_at on public.tgd_customer_withdrawal_requests;
create trigger set_tgd_customer_withdrawal_requests_updated_at
before update on public.tgd_customer_withdrawal_requests
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. RLS draft (customer-scoped + internal roles). Uses existing helper functions.
-- customer_admin / customer_user roles are design placeholders until role constraint migration.
-- ---------------------------------------------------------------------------

alter table public.tgd_customer_deposit_requests enable row level security;
alter table public.tgd_customer_deposit_request_lines enable row level security;
alter table public.tgd_customer_withdrawal_requests enable row level security;
alter table public.tgd_customer_withdrawal_request_lines enable row level security;
alter table public.tgd_customer_document_attachments enable row level security;
alter table public.tgd_customer_document_timeline_events enable row level security;

-- Deposit request header
drop policy if exists rls_customer_deposit_requests_select on public.tgd_customer_deposit_requests;
create policy rls_customer_deposit_requests_select
on public.tgd_customer_deposit_requests
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_deposit_requests_insert on public.tgd_customer_deposit_requests;
create policy rls_customer_deposit_requests_insert
on public.tgd_customer_deposit_requests
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
      and status in ('DRAFT', 'SUBMITTED_BY_CUSTOMER')
    )
  )
);

drop policy if exists rls_customer_deposit_requests_update on public.tgd_customer_deposit_requests;
create policy rls_customer_deposit_requests_update
on public.tgd_customer_deposit_requests
for update
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
      and status in ('DRAFT', 'SUBMITTED_BY_CUSTOMER')
    )
  )
)
with check (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
      and status in ('DRAFT', 'SUBMITTED_BY_CUSTOMER')
    )
  )
);

-- Deposit request lines (inherit customer scope via parent)
drop policy if exists rls_customer_deposit_request_lines_select on public.tgd_customer_deposit_request_lines;
create policy rls_customer_deposit_request_lines_select
on public.tgd_customer_deposit_request_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.tgd_customer_deposit_requests d
    where d.id = deposit_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer')
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = d.customer_id
        )
      )
  )
);

drop policy if exists rls_customer_deposit_request_lines_insert on public.tgd_customer_deposit_request_lines;
create policy rls_customer_deposit_request_lines_insert
on public.tgd_customer_deposit_request_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tgd_customer_deposit_requests d
    where d.id = deposit_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in ('admin', 'accounting')
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = d.customer_id
          and d.status in ('DRAFT', 'SUBMITTED_BY_CUSTOMER')
        )
      )
  )
);

drop policy if exists rls_customer_deposit_request_lines_update on public.tgd_customer_deposit_request_lines;
create policy rls_customer_deposit_request_lines_update
on public.tgd_customer_deposit_request_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.tgd_customer_deposit_requests d
    where d.id = deposit_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in ('admin', 'accounting')
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = d.customer_id
          and d.status in ('DRAFT', 'SUBMITTED_BY_CUSTOMER')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.tgd_customer_deposit_requests d
    where d.id = deposit_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in ('admin', 'accounting')
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = d.customer_id
          and d.status in ('DRAFT', 'SUBMITTED_BY_CUSTOMER')
        )
      )
  )
);

-- Withdrawal request header (mirror deposit patterns)
drop policy if exists rls_customer_withdrawal_requests_select on public.tgd_customer_withdrawal_requests;
create policy rls_customer_withdrawal_requests_select
on public.tgd_customer_withdrawal_requests
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_withdrawal_requests_insert on public.tgd_customer_withdrawal_requests;
create policy rls_customer_withdrawal_requests_insert
on public.tgd_customer_withdrawal_requests
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
      and status in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER')
    )
  )
);

drop policy if exists rls_customer_withdrawal_requests_update on public.tgd_customer_withdrawal_requests;
create policy rls_customer_withdrawal_requests_update
on public.tgd_customer_withdrawal_requests
for update
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
      and status in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER')
    )
  )
)
with check (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
      and status in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER')
    )
  )
);

-- Withdrawal lines
drop policy if exists rls_customer_withdrawal_request_lines_select on public.tgd_customer_withdrawal_request_lines;
create policy rls_customer_withdrawal_request_lines_select
on public.tgd_customer_withdrawal_request_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.tgd_customer_withdrawal_requests w
    where w.id = withdrawal_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer')
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = w.customer_id
        )
      )
  )
);

drop policy if exists rls_customer_withdrawal_request_lines_insert on public.tgd_customer_withdrawal_request_lines;
create policy rls_customer_withdrawal_request_lines_insert
on public.tgd_customer_withdrawal_request_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tgd_customer_withdrawal_requests w
    where w.id = withdrawal_request_id
      and public.tgd_current_user_is_active()
      and (
        public.tgd_current_user_role() in ('admin', 'accounting')
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = w.customer_id
          and w.status in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER')
        )
      )
  )
);

-- Attachments
drop policy if exists rls_customer_document_attachments_select on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_select
on public.tgd_customer_document_attachments
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_staff')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_document_attachments_insert on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_insert
on public.tgd_customer_document_attachments
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

-- Timeline events: append-only for authenticated actors; customers read own scope
drop policy if exists rls_customer_document_timeline_events_select on public.tgd_customer_document_timeline_events;
create policy rls_customer_document_timeline_events_select
on public.tgd_customer_document_timeline_events
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_staff', 'viewer')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_document_timeline_events_insert on public.tgd_customer_document_timeline_events;
create policy rls_customer_document_timeline_events_insert
on public.tgd_customer_document_timeline_events
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
);

revoke delete on public.tgd_customer_deposit_requests from anon, authenticated;
revoke delete on public.tgd_customer_deposit_request_lines from anon, authenticated;
revoke delete on public.tgd_customer_withdrawal_requests from anon, authenticated;
revoke delete on public.tgd_customer_withdrawal_request_lines from anon, authenticated;
revoke delete on public.tgd_customer_document_attachments from anon, authenticated;
revoke delete on public.tgd_customer_document_timeline_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Source linkage to internal execution documents — DEFERRED (Gate 2C/2E)
-- Recommended Option 1 (nullable FK on existing headers). Not applied here.
--
-- alter table public.tgd_receiving_documents
--   add column if not exists source_customer_deposit_request_id uuid
--     references public.tgd_customer_deposit_requests(id);
-- alter table public.tgd_receiving_documents
--   add column if not exists source_customer_deposit_request_no text;
-- alter table public.tgd_withdrawal_requests
--   add column if not exists source_customer_withdrawal_request_id uuid
--     references public.tgd_customer_withdrawal_requests(id);
-- alter table public.tgd_withdrawal_requests
--   add column if not exists source_customer_withdrawal_no text;
-- alter table public.tgd_picking_documents
--   add column if not exists source_customer_withdrawal_request_id uuid
--     references public.tgd_customer_withdrawal_requests(id);
-- alter table public.tgd_dispatch_documents
--   add column if not exists source_customer_withdrawal_request_id uuid
--     references public.tgd_customer_withdrawal_requests(id);
--
-- Option 2 mapping tables (alternative):
-- tgd_customer_deposit_receiving_links(deposit_request_id, receiving_document_id, ...)
-- tgd_customer_withdrawal_execution_links(withdrawal_request_id, internal_withdrawal_request_id, ...)
-- ---------------------------------------------------------------------------

commit;

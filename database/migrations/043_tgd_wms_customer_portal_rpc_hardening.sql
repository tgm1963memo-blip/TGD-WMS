-- 043_tgd_wms_customer_portal_rpc_hardening.sql
-- CUSTOMER-PORTAL-2E: source-document transition RPC hardening.
-- DRAFT ONLY - do not apply without Controller approval.
-- Prerequisites: migrations 040, 041, and the approved UAT foundation remediation.
-- Scope is limited to customer source-document status transitions and timeline audit.

begin;

-- Header transitions and timeline writes are RPC-only after this migration.
drop policy if exists rls_customer_deposit_requests_update
  on public.tgd_customer_deposit_requests;
drop policy if exists rls_customer_withdrawal_requests_update
  on public.tgd_customer_withdrawal_requests;
drop policy if exists rls_customer_document_timeline_events_insert
  on public.tgd_customer_document_timeline_events;

revoke update on public.tgd_customer_deposit_requests from anon, authenticated;
revoke update on public.tgd_customer_withdrawal_requests from anon, authenticated;
revoke insert on public.tgd_customer_document_timeline_events from anon, authenticated;

-- Draft creation and line editing remain a temporary direct-table path.
-- Header INSERT is narrowed to draft creation only. Customer line writes are
-- narrowed to the draft status only.
drop policy if exists rls_customer_deposit_requests_insert
  on public.tgd_customer_deposit_requests;
create policy rls_customer_deposit_requests_insert
on public.tgd_customer_deposit_requests
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and status = 'DRAFT'
  and (
    public.tgd_current_user_role() in ('admin', 'accounting')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_withdrawal_requests_insert
  on public.tgd_customer_withdrawal_requests;
create policy rls_customer_withdrawal_requests_insert
on public.tgd_customer_withdrawal_requests
for insert
to authenticated
with check (
  public.tgd_current_user_is_active()
  and status = 'WITHDRAWAL_DRAFT'
  and (
    public.tgd_current_user_role() in ('admin', 'accounting')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

drop policy if exists rls_customer_deposit_request_lines_insert
  on public.tgd_customer_deposit_request_lines;
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
          and d.status = 'DRAFT'
        )
      )
  )
);

drop policy if exists rls_customer_deposit_request_lines_update
  on public.tgd_customer_deposit_request_lines;
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
          and d.status = 'DRAFT'
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
          and d.status = 'DRAFT'
        )
      )
  )
);

drop policy if exists rls_customer_withdrawal_request_lines_insert
  on public.tgd_customer_withdrawal_request_lines;
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
          and w.status = 'WITHDRAWAL_DRAFT'
        )
      )
  )
);

drop policy if exists rls_customer_withdrawal_request_lines_update
  on public.tgd_customer_withdrawal_request_lines;
revoke update on public.tgd_customer_withdrawal_request_lines from anon, authenticated;

create or replace function public.tgd_submit_customer_deposit_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('customer_admin', 'customer_user') then
    raise exception 'Customer role required to submit a deposit request';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;
  if v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id then
    raise exception 'Customer scope violation';
  end if;
  if v_document.status <> 'DRAFT' then
    raise exception 'Deposit request must be DRAFT before submission';
  end if;

  update public.tgd_customer_deposit_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER',
    'action', 'SUBMIT'
  );
end;
$$;

create or replace function public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required to review a deposit request';
  end if;
  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING') then
    raise exception 'Decision must be ACCEPT, REJECT, or REVIEWING';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  else
    raise exception 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_deposit_requests
  set status = v_to_status,
      reviewed_by_user_id = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      review_comment = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, v_to_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', v_to_status,
    'action', 'REVIEW_' || v_decision
  );
end;
$$;

create or replace function public.tgd_cancel_customer_deposit_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('customer_admin', 'customer_user', 'admin', 'accounting') then
    raise exception 'Role is not allowed to cancel a deposit request';
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id then
      raise exception 'Customer scope violation';
    end if;
    if v_document.status not in ('DRAFT', 'SUBMITTED_BY_CUSTOMER') then
      raise exception 'Customer cannot cancel deposit request from status %', v_document.status;
    end if;
  elsif v_document.status in (
    'ADMIN_REJECTED',
    'RECEIVED_CONFIRMED',
    'CUSTOMER_NOTIFIED',
    'CLOSED',
    'CANCELLED'
  ) then
    raise exception 'Deposit request is terminal and cannot be cancelled';
  end if;

  update public.tgd_customer_deposit_requests
  set status = 'CANCELLED',
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'CANCEL', v_document.status, 'CANCELLED',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'CANCELLED',
    'action', 'CANCEL'
  );
end;
$$;

create or replace function public.tgd_submit_customer_withdrawal_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('customer_admin', 'customer_user') then
    raise exception 'Customer role required to submit a withdrawal request';
  end if;

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;
  if v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id then
    raise exception 'Customer scope violation';
  end if;
  if v_document.status <> 'WITHDRAWAL_DRAFT' then
    raise exception 'Withdrawal request must be WITHDRAWAL_DRAFT before submission';
  end if;

  update public.tgd_customer_withdrawal_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER',
    'action', 'SUBMIT'
  );
end;
$$;

create or replace function public.tgd_review_customer_withdrawal_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('admin', 'accounting') then
    raise exception 'Admin or accounting role required to review a withdrawal request';
  end if;
  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING') then
    raise exception 'Decision must be ACCEPT, REJECT, or REVIEWING';
  end if;

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  else
    raise exception 'Invalid withdrawal review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_withdrawal_requests
  set status = v_to_status,
      reviewed_by_user_id = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      reviewed_by_email = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email end,
      reviewed_at = case when v_decision in ('ACCEPT', 'REJECT') then now() else reviewed_at end,
      review_comment = nullif(btrim(p_comment), ''),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status, v_to_status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', v_to_status,
    'action', 'REVIEW_' || v_decision
  );
end;
$$;

create or replace function public.tgd_cancel_customer_withdrawal_request(
  p_request_id uuid,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('customer_admin', 'customer_user', 'admin', 'accounting') then
    raise exception 'Role is not allowed to cancel a withdrawal request';
  end if;

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id then
      raise exception 'Customer scope violation';
    end if;
    if v_document.status not in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER') then
      raise exception 'Customer cannot cancel withdrawal request from status %', v_document.status;
    end if;
  elsif v_document.status in (
    'ADMIN_REJECTED',
    'LOADED_CONFIRMED',
    'CUSTOMER_NOTIFIED',
    'CLOSED',
    'CANCELLED'
  ) then
    raise exception 'Withdrawal request is terminal and cannot be cancelled';
  end if;

  update public.tgd_customer_withdrawal_requests
  set status = 'CANCELLED',
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'CANCEL', v_document.status, 'CANCELLED',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'id', v_document.id,
    'customer_id', v_document.customer_id,
    'status', 'CANCELLED',
    'action', 'CANCEL'
  );
end;
$$;

revoke all on function public.tgd_submit_customer_deposit_request(uuid, text)
  from public, anon;
revoke all on function public.tgd_review_customer_deposit_request(uuid, text, text)
  from public, anon;
revoke all on function public.tgd_cancel_customer_deposit_request(uuid, text)
  from public, anon;
revoke all on function public.tgd_submit_customer_withdrawal_request(uuid, text)
  from public, anon;
revoke all on function public.tgd_review_customer_withdrawal_request(uuid, text, text)
  from public, anon;
revoke all on function public.tgd_cancel_customer_withdrawal_request(uuid, text)
  from public, anon;

grant execute on function public.tgd_submit_customer_deposit_request(uuid, text)
  to authenticated;
grant execute on function public.tgd_review_customer_deposit_request(uuid, text, text)
  to authenticated;
grant execute on function public.tgd_cancel_customer_deposit_request(uuid, text)
  to authenticated;
grant execute on function public.tgd_submit_customer_withdrawal_request(uuid, text)
  to authenticated;
grant execute on function public.tgd_review_customer_withdrawal_request(uuid, text, text)
  to authenticated;
grant execute on function public.tgd_cancel_customer_withdrawal_request(uuid, text)
  to authenticated;

comment on function public.tgd_submit_customer_deposit_request(uuid, text) is
  'CUSTOMER-PORTAL-2E transition only; no warehouse execution side effects.';
comment on function public.tgd_submit_customer_withdrawal_request(uuid, text) is
  'CUSTOMER-PORTAL-2E transition only; no warehouse execution side effects.';

commit;

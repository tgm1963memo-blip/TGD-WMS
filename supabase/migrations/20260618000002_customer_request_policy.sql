-- 053_tgd_wms_customer_request_policy.sql
-- Admin-configurable cancellation lead time for customer deposit/withdrawal requests.

begin;

create table if not exists public.tgd_customer_request_policy (
  id integer primary key default 1 check (id = 1),
  deposit_cancel_lead_days integer not null default 3 check (deposit_cancel_lead_days >= 0),
  withdrawal_cancel_lead_days integer not null default 3 check (withdrawal_cancel_lead_days >= 0),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references public.tgd_user_profiles(id)
);

insert into public.tgd_customer_request_policy (id)
values (1)
on conflict (id) do nothing;

alter table public.tgd_customer_request_policy enable row level security;

drop policy if exists tgd_customer_request_policy_read on public.tgd_customer_request_policy;
create policy tgd_customer_request_policy_read
  on public.tgd_customer_request_policy
  for select
  to authenticated
  using (true);

create or replace function public.tgd_get_customer_request_policy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy record;
begin
  if auth.uid() is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.deposit_cancel_lead_days, p.withdrawal_cancel_lead_days, p.updated_at
  into v_policy
  from public.tgd_customer_request_policy p
  where p.id = 1;

  if not found then
    return jsonb_build_object(
      'deposit_cancel_lead_days', 3,
      'withdrawal_cancel_lead_days', 3
    );
  end if;

  return jsonb_build_object(
    'deposit_cancel_lead_days', v_policy.deposit_cancel_lead_days,
    'withdrawal_cancel_lead_days', v_policy.withdrawal_cancel_lead_days,
    'updated_at', v_policy.updated_at
  );
end;
$$;

create or replace function public.tgd_update_customer_request_policy(
  p_deposit_cancel_lead_days integer,
  p_withdrawal_cancel_lead_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found or v_profile.role not in ('admin', 'accounting') then
    raise exception 'Only admin or accounting can update customer request policy';
  end if;

  if p_deposit_cancel_lead_days < 0 or p_withdrawal_cancel_lead_days < 0 then
    raise exception 'Lead days must be zero or greater';
  end if;

  update public.tgd_customer_request_policy
  set deposit_cancel_lead_days = p_deposit_cancel_lead_days,
      withdrawal_cancel_lead_days = p_withdrawal_cancel_lead_days,
      updated_at = now(),
      updated_by_user_id = v_profile.id
  where id = 1;

  return public.tgd_get_customer_request_policy();
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
  v_policy record;
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

  select d.id, d.customer_id, d.status, d.expected_arrival_date
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  select p.deposit_cancel_lead_days, p.withdrawal_cancel_lead_days
  into v_policy
  from public.tgd_customer_request_policy p
  where p.id = 1;

  if not found then
    v_policy.deposit_cancel_lead_days := 3;
    v_policy.withdrawal_cancel_lead_days := 3;
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id then
      raise exception 'Customer scope violation';
    end if;
    if v_document.status not in ('DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED') then
      raise exception 'Customer cannot cancel deposit request from status %', v_document.status;
    end if;
    if v_document.status <> 'DRAFT'
       and v_document.expected_arrival_date is not null
       and v_document.expected_arrival_date < (current_date + v_policy.deposit_cancel_lead_days) then
      raise exception 'Cancellation must be requested at least % day(s) before the expected arrival date', v_policy.deposit_cancel_lead_days;
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
  v_policy record;
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

  select w.id, w.customer_id, w.status, w.requested_dispatch_date
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  select p.deposit_cancel_lead_days, p.withdrawal_cancel_lead_days
  into v_policy
  from public.tgd_customer_request_policy p
  where p.id = 1;

  if not found then
    v_policy.deposit_cancel_lead_days := 3;
    v_policy.withdrawal_cancel_lead_days := 3;
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_document.customer_id then
      raise exception 'Customer scope violation';
    end if;
    if v_document.status not in ('WITHDRAWAL_DRAFT', 'SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING', 'ADMIN_ACCEPTED') then
      raise exception 'Customer cannot cancel withdrawal request from status %', v_document.status;
    end if;
    if v_document.status <> 'WITHDRAWAL_DRAFT'
       and v_document.requested_dispatch_date is not null
       and v_document.requested_dispatch_date < (current_date + v_policy.withdrawal_cancel_lead_days) then
      raise exception 'Cancellation must be requested at least % day(s) before the requested dispatch date', v_policy.withdrawal_cancel_lead_days;
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

revoke all on function public.tgd_get_customer_request_policy() from public;
revoke all on function public.tgd_update_customer_request_policy(integer, integer) from public;
grant execute on function public.tgd_get_customer_request_policy() to authenticated;
grant execute on function public.tgd_update_customer_request_policy(integer, integer) to authenticated;

commit;

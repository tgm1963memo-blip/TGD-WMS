-- Lets a custom staff role (tgd_role_definitions — e.g. "Ovo-deposit",
-- "ovo-withdraw", both currently unrestricted-viewer) be permanently tied
-- to ONE customer, so a staff account assigned that role only sees (and
-- can only act on behalf of) that customer's data — not every customer's,
-- which is what every staff role does today regardless of name.
--
-- Design: customer_id lives on the ROLE DEFINITION, not on the individual
-- staff profile — assign the role once with a customer, and every staff
-- account given that role_code inherits the scope automatically. NULL
-- (the default, and every existing role's current value) means
-- unrestricted — zero behavior change for every role that isn't
-- explicitly scoped.
--
-- tgd_current_user_role_customer_scope() mirrors the same join
-- tgd_current_user_role() already does (see 20260729110000) but returns
-- customer_id instead of base_role — the two are deliberately separate
-- functions since a caller's role and their customer-scope are
-- orthogonal questions.
--
-- Scope of this pass: the tables directly implied by the two example
-- roles' names (deposit/withdrawal, plus stock balance/movements and the
-- document attachments+timeline attached to those documents) and the
-- shared RPC helper that resolves who a proxy-role create RPC acts on
-- behalf of. Billing, receiving, and the legacy (non-customer-portal)
-- warehouse-document tables are NOT scoped by this migration — every
-- existing unrestricted-staff RLS policy on those is untouched.

begin;

alter table public.tgd_role_definitions
  add column if not exists customer_id uuid references public.tgd_customers(id);

create or replace function public.tgd_current_user_role_customer_scope()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select rd.customer_id
  from public.tgd_user_profiles p
  left join public.tgd_role_definitions rd on rd.role_code = p.role
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

grant execute on function public.tgd_current_user_role_customer_scope() to authenticated;

-- General-purpose "resolve any role_code to its effective base role"
-- helper — same rule tgd_current_user_role() applies to the CALLER's own
-- role, but usable against an arbitrary role_code value (needed below by
-- tgd_is_customer_request_proxy_role, which historically checked its
-- p_role argument verbatim against the 4 built-in proxy roles, so a
-- custom role built on e.g. warehouse_admin could never create documents
-- on a customer's behalf — it simply isn't one of those 4 literal
-- strings).
create or replace function public.tgd_resolve_role_base(p_role text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select case when rd.is_system then p_role else coalesce(rd.base_role, p_role) end
      from public.tgd_role_definitions rd
      where rd.role_code = lower(coalesce(p_role, ''))
    ),
    p_role
  )
$$;

grant execute on function public.tgd_resolve_role_base(text) to authenticated;

create or replace function public.tgd_is_customer_request_proxy_role(p_role text)
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(public.tgd_resolve_role_base(p_role), '')) in (
    'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  );
$$;

-- ── Deposit requests + lines ────────────────────────────────────────────
drop policy if exists rls_customer_deposit_requests_select on public.tgd_customer_deposit_requests;
create policy rls_customer_deposit_requests_select
on public.tgd_customer_deposit_requests
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
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

drop policy if exists rls_customer_deposit_request_lines_select on public.tgd_customer_deposit_request_lines;
create policy rls_customer_deposit_request_lines_select
on public.tgd_customer_deposit_request_lines
for select to authenticated
using (
  exists (
    select 1 from public.tgd_customer_deposit_requests d
    where d.id = deposit_request_id
      and public.tgd_current_user_is_active()
      and (
        (
          public.tgd_current_user_role() in (
            'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
          )
          and (
            public.tgd_current_user_role_customer_scope() is null
            or public.tgd_current_user_role_customer_scope() = d.customer_id
          )
        )
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = d.customer_id
        )
      )
  )
);

-- ── Withdrawal requests + lines ─────────────────────────────────────────
drop policy if exists rls_customer_withdrawal_requests_select on public.tgd_customer_withdrawal_requests;
create policy rls_customer_withdrawal_requests_select
on public.tgd_customer_withdrawal_requests
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
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

drop policy if exists rls_customer_withdrawal_request_lines_select on public.tgd_customer_withdrawal_request_lines;
create policy rls_customer_withdrawal_request_lines_select
on public.tgd_customer_withdrawal_request_lines
for select to authenticated
using (
  exists (
    select 1 from public.tgd_customer_withdrawal_requests w
    where w.id = withdrawal_request_id
      and public.tgd_current_user_is_active()
      and (
        (
          public.tgd_current_user_role() in (
            'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
          )
          and (
            public.tgd_current_user_role_customer_scope() is null
            or public.tgd_current_user_role_customer_scope() = w.customer_id
          )
        )
        or (
          public.tgd_current_user_role() in ('customer_admin', 'customer_user')
          and public.tgd_current_user_customer_id() = w.customer_id
        )
      )
  )
);

-- ── Document attachments + timeline (same documents, same scope) ───────
drop policy if exists rls_customer_document_attachments_select on public.tgd_customer_document_attachments;
create policy rls_customer_document_attachments_select
on public.tgd_customer_document_attachments
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting'
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

drop policy if exists rls_customer_document_timeline_events_select on public.tgd_customer_document_timeline_events;
create policy rls_customer_document_timeline_events_select
on public.tgd_customer_document_timeline_events
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
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

-- ── Stock balances + movements ───────────────────────────────────────────
drop policy if exists rls_stock_movements_read on public.tgd_stock_movements;
create policy rls_stock_movements_read
  on public.tgd_stock_movements
  for select
  using (
    (
      public.tgd_current_user_role() in (
        'admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'accounting', 'viewer'
      )
      and (
        public.tgd_current_user_role_customer_scope() is null
        or public.tgd_current_user_role_customer_scope() = customer_id
      )
    )
    or public.tgd_current_user_customer_id() = customer_id
  );

drop policy if exists rls_stock_balances_read on public.tgd_stock_balances;
create policy rls_stock_balances_read
  on public.tgd_stock_balances
  for select
  using (
    (
      public.tgd_current_user_role() in (
        'admin', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'accounting', 'viewer'
      )
      and (
        public.tgd_current_user_role_customer_scope() is null
        or public.tgd_current_user_role_customer_scope() = customer_id
      )
    )
    or public.tgd_current_user_customer_id() = customer_id
  );

-- ── Write path: a scoped role can only act on behalf of its own customer ─
-- Every create-on-behalf-of-a-customer RPC (deposit/withdrawal/facility
-- usage) funnels through this one function to resolve the target
-- customer_id — fixing it here covers all of them without touching each
-- RPC individually.
create or replace function public.tgd_resolve_customer_request_target_id(
  p_role text,
  p_actor_customer_id uuid,
  p_customer_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_role_scope_customer_id uuid := public.tgd_current_user_role_customer_scope();
  v_target_customer_id uuid := p_customer_id;
begin
  if p_role in ('customer_admin', 'customer_user') then
    return p_actor_customer_id;
  elsif public.tgd_is_customer_request_proxy_role(p_role) then
    if v_target_customer_id is null then
      v_target_customer_id := v_role_scope_customer_id;
    end if;
    if v_target_customer_id is null then
      raise exception 'customer_id required when creating on behalf of a customer';
    end if;
    if v_role_scope_customer_id is not null and v_role_scope_customer_id <> v_target_customer_id then
      raise exception 'This role is scoped to a single customer and cannot act for a different one';
    end if;
    if not exists (
      select 1 from public.tgd_customers c
      where c.id = v_target_customer_id and c.is_active = true
    ) then
      raise exception 'Active customer not found';
    end if;
    return v_target_customer_id;
  else
    raise exception 'Unauthorized role for customer request action';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

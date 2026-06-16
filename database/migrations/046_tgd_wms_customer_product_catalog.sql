-- 046_tgd_wms_customer_product_catalog.sql
-- CUSTOMER-CATALOG-046: Customer-owned product catalog with scoped RLS and RPC writes.
-- DRAFT ONLY — do NOT apply without Controller approval.
-- Prerequisites: migrations 040, 041, 045 applied.
-- Scope: catalog master only. No stock movement.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.tgd_customer_products (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.tgd_customers(id),
  customer_product_code text not null,
  product_name text not null,
  internal_product_code text,
  internal_product_id uuid references public.tgd_products(id),
  uom text,
  temperature_type text,
  is_active boolean not null default true,
  note text,
  created_by_user_id uuid references public.tgd_user_profiles(id),
  updated_by_user_id uuid references public.tgd_user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_customer_products_customer_code_unique unique (customer_id, customer_product_code),
  constraint tgd_customer_products_temperature_type_check check (
    temperature_type is null or temperature_type in ('FROZEN', 'CHILLED', 'AMBIENT')
  )
);

create index if not exists tgd_customer_products_customer_id_idx
  on public.tgd_customer_products (customer_id);
create index if not exists tgd_customer_products_customer_product_code_idx
  on public.tgd_customer_products (customer_product_code);
create index if not exists tgd_customer_products_is_active_idx
  on public.tgd_customer_products (is_active);

drop trigger if exists set_tgd_customer_products_updated_at on public.tgd_customer_products;
create trigger set_tgd_customer_products_updated_at
before update on public.tgd_customer_products
for each row execute function public.set_updated_at();

comment on table public.tgd_customer_products is
  'CUSTOMER-CATALOG-046: Customer-owned product codes used in deposit/withdrawal portal forms.';

-- ---------------------------------------------------------------------------
-- 2. RLS — SELECT scoped; writes via RPC only
-- ---------------------------------------------------------------------------

alter table public.tgd_customer_products enable row level security;

drop policy if exists rls_customer_products_select on public.tgd_customer_products;
create policy rls_customer_products_select
on public.tgd_customer_products
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

revoke insert, update, delete on public.tgd_customer_products from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Upsert customer product
-- ---------------------------------------------------------------------------

create or replace function public.tgd_upsert_customer_product(
  p_product_id uuid default null,
  p_customer_id uuid default null,
  p_customer_product_code text default null,
  p_product_name text default null,
  p_internal_product_code text default null,
  p_internal_product_id uuid default null,
  p_uom text default null,
  p_temperature_type text default null,
  p_note text default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_customer_id uuid;
  v_code text := nullif(btrim(p_customer_product_code), '');
  v_name text := nullif(btrim(p_product_name), '');
  v_temp text := nullif(upper(btrim(p_temperature_type)), '');
  v_product_id uuid;
  v_action text;
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

  if not found then
    raise exception 'Active user profile required';
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null then
      raise exception 'Customer profile must be linked to a customer_id';
    end if;
    v_customer_id := v_profile.customer_id;
  elsif v_profile.role = 'admin' then
    v_customer_id := p_customer_id;
    if v_customer_id is null then
      raise exception 'customer_id is required for admin catalog writes';
    end if;
  else
    raise exception 'Insufficient role to manage customer product catalog';
  end if;

  if v_code is null then
    raise exception 'customer_product_code is required';
  end if;
  if v_name is null then
    raise exception 'product_name is required';
  end if;

  if v_temp is not null and v_temp not in ('FROZEN', 'CHILLED', 'AMBIENT') then
    raise exception 'temperature_type must be FROZEN, CHILLED, or AMBIENT';
  end if;

  if not exists (select 1 from public.tgd_customers c where c.id = v_customer_id) then
    raise exception 'customer_id not found';
  end if;

  if p_internal_product_id is not null
    and not exists (select 1 from public.tgd_products pr where pr.id = p_internal_product_id) then
    raise exception 'internal_product_id not found';
  end if;

  if p_product_id is not null then
    if not exists (
      select 1 from public.tgd_customer_products cp
      where cp.id = p_product_id and cp.customer_id = v_customer_id
    ) then
      raise exception 'Customer product not found for this scope';
    end if;

    if exists (
      select 1 from public.tgd_customer_products cp
      where cp.customer_id = v_customer_id
        and lower(cp.customer_product_code) = lower(v_code)
        and cp.id <> p_product_id
    ) then
      raise exception 'customer_product_code already exists for this customer';
    end if;

    update public.tgd_customer_products
    set
      customer_product_code = v_code,
      product_name = v_name,
      internal_product_code = nullif(btrim(p_internal_product_code), ''),
      internal_product_id = p_internal_product_id,
      uom = nullif(btrim(p_uom), ''),
      temperature_type = v_temp,
      note = nullif(btrim(p_note), ''),
      is_active = coalesce(p_is_active, true),
      updated_by_user_id = v_profile.id,
      updated_at = now()
    where id = p_product_id
    returning id into v_product_id;

    v_action := 'UPDATE_CUSTOMER_PRODUCT';
  else
    if exists (
      select 1 from public.tgd_customer_products cp
      where cp.customer_id = v_customer_id
        and lower(cp.customer_product_code) = lower(v_code)
    ) then
      raise exception 'customer_product_code already exists for this customer';
    end if;

    insert into public.tgd_customer_products (
      customer_id, customer_product_code, product_name,
      internal_product_code, internal_product_id, uom, temperature_type,
      note, is_active, created_by_user_id, updated_by_user_id
    ) values (
      v_customer_id, v_code, v_name,
      nullif(btrim(p_internal_product_code), ''), p_internal_product_id,
      nullif(btrim(p_uom), ''), v_temp,
      nullif(btrim(p_note), ''), coalesce(p_is_active, true),
      v_profile.id, v_profile.id
    )
    returning id into v_product_id;

    v_action := 'CREATE_CUSTOMER_PRODUCT';
  end if;

  return jsonb_build_object(
    'id', v_product_id,
    'customer_id', v_customer_id,
    'customer_product_code', v_code,
    'product_name', v_name,
    'internal_product_code', nullif(btrim(p_internal_product_code), ''),
    'internal_product_id', p_internal_product_id,
    'uom', nullif(btrim(p_uom), ''),
    'temperature_type', v_temp,
    'is_active', coalesce(p_is_active, true),
    'action', v_action
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Deactivate customer product (soft delete)
-- ---------------------------------------------------------------------------

create or replace function public.tgd_deactivate_customer_product(
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_row record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active user profile required';
  end if;

  select cp.id, cp.customer_id, cp.customer_product_code, cp.product_name
  into v_row
  from public.tgd_customer_products cp
  where cp.id = p_product_id
  limit 1;

  if not found then
    raise exception 'Customer product not found';
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_row.customer_id then
      raise exception 'Customer scope mismatch';
    end if;
  elsif v_profile.role <> 'admin' then
    raise exception 'Insufficient role to deactivate customer product';
  end if;

  update public.tgd_customer_products
  set is_active = false, updated_by_user_id = v_profile.id, updated_at = now()
  where id = p_product_id;

  return jsonb_build_object(
    'id', p_product_id,
    'customer_id', v_row.customer_id,
    'customer_product_code', v_row.customer_product_code,
    'is_active', false,
    'action', 'DEACTIVATE_CUSTOMER_PRODUCT'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------

revoke all on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, boolean) from public, anon;
revoke all on function public.tgd_deactivate_customer_product(uuid) from public, anon;

grant execute on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, boolean) to authenticated;
grant execute on function public.tgd_deactivate_customer_product(uuid) to authenticated;

comment on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, boolean) is
  'CUSTOMER-CATALOG-046: Customer-scoped or admin catalog upsert.';
comment on function public.tgd_deactivate_customer_product(uuid) is
  'CUSTOMER-CATALOG-046: Soft-deactivate a customer product row.';

commit;

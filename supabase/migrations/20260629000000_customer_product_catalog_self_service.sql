-- Migration: 20260629000000_customer_product_catalog_self_service.sql
-- Allow customer_admin to manage their own customer's product catalog.
-- customer_user can read (SELECT) via RLS. customer_admin can insert/update.

begin;

-- 1. RLS: ensure enabled on tgd_customer_products
alter table public.tgd_customer_products enable row level security;

-- 2. Allow customer portal users to SELECT their own customer's products
drop policy if exists "customer portal read own products" on public.tgd_customer_products;
create policy "customer portal read own products"
  on public.tgd_customer_products
  for select
  using (
    exists (
      select 1
      from public.tgd_user_profiles p
      where p.auth_user_id = auth.uid()
        and p.is_active = true
        and p.role in ('customer_admin', 'customer_user')
        and p.customer_id = tgd_customer_products.customer_id
    )
  );

-- 3. Update tgd_upsert_customer_product to allow customer_admin for their own customer
create or replace function public.tgd_upsert_customer_product(
  p_product_id uuid default null,
  p_customer_id uuid default null,
  p_customer_product_code text default null,
  p_product_name text default null,
  p_internal_product_code text default null,
  p_internal_product_id uuid default null,
  p_uom text default null,
  p_temperature_type text default null,
  p_argent_type text default null,
  p_storage_charge_basis text default null,
  p_pack_weight_kg numeric default null,
  p_allergen text default null,
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
  v_argent text := nullif(upper(btrim(p_argent_type)), '');
  v_basis text := nullif(upper(btrim(p_storage_charge_basis)), '');
  v_product_id uuid;
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

  -- Internal staff can manage any customer's catalog.
  -- customer_admin can only manage their own customer's catalog.
  if v_profile.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    v_customer_id := p_customer_id;
    if v_customer_id is null then
      raise exception 'customer_id is required for catalog writes';
    end if;
  elsif v_profile.role = 'customer_admin' then
    -- Lock to their own customer; ignore p_customer_id for security
    v_customer_id := v_profile.customer_id;
    if v_customer_id is null then
      raise exception 'Your account is not linked to a customer';
    end if;
    -- If editing an existing product, verify it belongs to their customer
    if p_product_id is not null then
      if not exists (
        select 1 from public.tgd_customer_products
        where id = p_product_id and customer_id = v_customer_id
      ) then
        raise exception 'You can only edit products belonging to your own customer account';
      end if;
    end if;
  else
    raise exception 'You do not have permission to manage the product catalog';
  end if;

  if v_code is null then raise exception 'customer_product_code is required'; end if;
  if v_name is null then raise exception 'product_name is required'; end if;

  if v_temp is not null and v_temp not in ('FROZEN', 'CHILLED', 'AMBIENT') then
    raise exception 'temperature_type must be FROZEN, CHILLED, or AMBIENT';
  end if;
  if v_argent is not null and v_argent not in ('ARGENT', 'NON_ARGENT') then
    raise exception 'argent_type must be ARGENT or NON_ARGENT';
  end if;
  if v_basis is not null and v_basis not in ('WEIGHT', 'PALLET') then
    raise exception 'storage_charge_basis must be WEIGHT or PALLET';
  end if;
  if p_pack_weight_kg is not null and p_pack_weight_kg < 0 then
    raise exception 'pack_weight_kg must be zero or greater';
  end if;

  if not exists (select 1 from public.tgd_customers c where c.id = v_customer_id) then
    raise exception 'customer_id not found';
  end if;

  if p_product_id is not null then
    update public.tgd_customer_products
    set customer_product_code  = v_code,
        product_name           = v_name,
        internal_product_code  = nullif(btrim(p_internal_product_code), ''),
        internal_product_id    = p_internal_product_id,
        uom                    = nullif(btrim(p_uom), ''),
        temperature_type       = v_temp,
        argent_type            = v_argent,
        storage_charge_basis   = v_basis,
        pack_weight_kg         = p_pack_weight_kg,
        allergen               = nullif(btrim(p_allergen), ''),
        note                   = nullif(btrim(p_note), ''),
        is_active              = p_is_active,
        updated_by_user_id     = v_profile.id,
        updated_at             = now()
    where id = p_product_id
      and customer_id = v_customer_id
    returning id into v_product_id;

    if not found then
      raise exception 'Product not found or customer mismatch';
    end if;
  else
    insert into public.tgd_customer_products
      (customer_id, customer_product_code, product_name, internal_product_code,
       internal_product_id, uom, temperature_type, argent_type, storage_charge_basis,
       pack_weight_kg, allergen, note, is_active, created_by_user_id, updated_by_user_id)
    values
      (v_customer_id, v_code, v_name,
       nullif(btrim(p_internal_product_code), ''), p_internal_product_id,
       nullif(btrim(p_uom), ''), v_temp, v_argent, v_basis,
       p_pack_weight_kg, nullif(btrim(p_allergen), ''), nullif(btrim(p_note), ''),
       p_is_active, v_profile.id, v_profile.id)
    returning id into v_product_id;
  end if;

  return (
    select jsonb_build_object(
      'id',                    cp.id,
      'customer_id',           cp.customer_id,
      'customer_product_code', cp.customer_product_code,
      'product_name',          cp.product_name,
      'internal_product_code', cp.internal_product_code,
      'uom',                   cp.uom,
      'temperature_type',      cp.temperature_type,
      'pack_weight_kg',        cp.pack_weight_kg,
      'allergen',              cp.allergen,
      'is_active',             cp.is_active
    )
    from public.tgd_customer_products cp
    where cp.id = v_product_id
  );
end;
$$;

-- 4. Create/replace tgd_deactivate_customer_product (allow customer_admin their own)
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
  v_customer_id uuid;
  v_product_customer_id uuid;
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

  select customer_id into v_product_customer_id
  from public.tgd_customer_products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  if v_profile.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    -- Can deactivate any
    null;
  elsif v_profile.role = 'customer_admin' then
    if v_profile.customer_id is null or v_profile.customer_id <> v_product_customer_id then
      raise exception 'You can only deactivate products belonging to your own customer account';
    end if;
  else
    raise exception 'You do not have permission to deactivate catalog products';
  end if;

  update public.tgd_customer_products
  set is_active = false, updated_at = now(), updated_by_user_id = v_profile.id
  where id = p_product_id;

  return jsonb_build_object('id', p_product_id, 'is_active', false);
end;
$$;

-- 5. Grant execute to authenticated
revoke all on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, text, numeric, text, text, boolean) from public, anon;
grant execute on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, text, numeric, text, text, boolean) to authenticated;

revoke all on function public.tgd_deactivate_customer_product(uuid) from public, anon;
grant execute on function public.tgd_deactivate_customer_product(uuid) to authenticated;

commit;

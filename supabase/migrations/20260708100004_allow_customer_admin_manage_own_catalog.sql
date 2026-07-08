-- 097_allow_customer_admin_manage_own_catalog.sql
-- BUGFIX: customer_admin users get "Only admin or warehouse staff can manage
-- customer product catalog" when adding/editing a product in their own
-- self-service catalog (CustomerProductCatalogPage.jsx).
--
-- Root cause: the original tgd_upsert_customer_product (migration 046) let
-- customer_admin/customer_user write to their own customer_id. Migration 058
-- (allergen + pack weight) replaced the function for the admin-side catalog
-- page and dropped that branch, leaving only internal staff roles. This
-- restores customer-portal self-service while keeping every field added
-- since (allergen, pack_weight_kg, argent_type, storage_charge_basis) and the
-- real-upsert-by-code fix from migration 096.

begin;

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
  v_target_id uuid;
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
    -- Self-service: always scoped to the caller's own customer, regardless
    -- of what p_customer_id the client sent.
    v_customer_id := v_profile.customer_id;
  elsif v_profile.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    v_customer_id := p_customer_id;
    if v_customer_id is null then
      raise exception 'customer_id is required for catalog writes';
    end if;
  else
    raise exception 'Only admin, warehouse staff, or customer admin can manage customer product catalog';
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

  v_target_id := p_product_id;

  -- If the caller is a customer self-service user, make sure an explicit
  -- product_id still belongs to their own customer (defense in depth).
  if v_target_id is not null and v_profile.role in ('customer_admin', 'customer_user') then
    if not exists (
      select 1 from public.tgd_customer_products cp
      where cp.id = v_target_id and cp.customer_id = v_customer_id
    ) then
      raise exception 'Customer product not found for this scope';
    end if;
  end if;

  -- No explicit product_id (the case for every Excel import row, and for
  -- create from the form): resolve the real target by the unique
  -- (customer_id, customer_product_code) key so re-saving an existing code
  -- updates the row instead of colliding with it.
  if v_target_id is null then
    select id into v_target_id
    from public.tgd_customer_products
    where customer_id = v_customer_id
      and customer_product_code = v_code
    limit 1;
  end if;

  if v_target_id is not null then
    update public.tgd_customer_products
    set customer_product_code = v_code,
        product_name = v_name,
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        internal_product_id = p_internal_product_id,
        uom = nullif(btrim(p_uom), ''),
        temperature_type = v_temp,
        argent_type = v_argent,
        storage_charge_basis = v_basis,
        pack_weight_kg = p_pack_weight_kg,
        allergen = nullif(btrim(p_allergen), ''),
        note = nullif(btrim(p_note), ''),
        is_active = coalesce(p_is_active, true),
        updated_by_user_id = v_profile.id,
        updated_at = now()
    where id = v_target_id and customer_id = v_customer_id
    returning id into v_product_id;
    if not found then raise exception 'Customer product not found for this scope'; end if;
    v_action := 'UPDATE_CUSTOMER_PRODUCT';
  else
    insert into public.tgd_customer_products (
      customer_id, customer_product_code, product_name,
      internal_product_code, internal_product_id, uom, temperature_type,
      argent_type, storage_charge_basis, pack_weight_kg, allergen,
      note, is_active, created_by_user_id, updated_by_user_id
    ) values (
      v_customer_id, v_code, v_name,
      nullif(btrim(p_internal_product_code), ''), p_internal_product_id,
      nullif(btrim(p_uom), ''), v_temp, v_argent, v_basis,
      p_pack_weight_kg, nullif(btrim(p_allergen), ''),
      nullif(btrim(p_note), ''), coalesce(p_is_active, true),
      v_profile.id, v_profile.id
    )
    returning id into v_product_id;
    v_action := 'INSERT_CUSTOMER_PRODUCT';
  end if;

  return jsonb_build_object('id', v_product_id, 'customer_id', v_customer_id, 'action', v_action);
end;
$$;

commit;

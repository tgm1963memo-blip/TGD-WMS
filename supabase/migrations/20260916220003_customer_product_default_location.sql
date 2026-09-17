-- Adds a default/assigned warehouse location per customer product, plus a
-- bulk-import RPC for the new Export/Import Excel feature on
-- WarehouseLocationSetupPage.jsx. No product<->location association existed
-- anywhere in the schema before this.

begin;

alter table public.tgd_customer_products
  add column if not exists default_location_id uuid references public.tgd_locations(id) on delete set null;

create index if not exists idx_tgd_customer_products_default_location_id
  on public.tgd_customer_products (default_location_id);

-- Per-row bulk import: resolves customer_code + customer_product_code to a
-- product, and location_code (optional) to a location, then sets
-- default_location_id. A row whose codes don't resolve is skipped entirely
-- (no partial save) and reported back with its row index -- same shape as
-- the existing tgd_import_opening_balance RPC's {processed, errors} pattern.
-- A blank location_code is valid and CLEARS the existing assignment.
create or replace function public.tgd_import_product_location_assignments(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_row jsonb;
  v_idx int := 0;
  v_customer_code text;
  v_customer_product_code text;
  v_location_code text;
  v_customer_id uuid;
  v_product_id uuid;
  v_location_id uuid;
  v_processed int := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then raise exception 'User profile not found'; end if;

  if v_profile.role not in ('admin','accounting','warehouse_admin','warehouse_manager','warehouse_staff') then
    raise exception 'Insufficient role to import product location assignments';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;
    v_customer_code := nullif(trim(v_row->>'customer_code'), '');
    v_customer_product_code := nullif(trim(v_row->>'customer_product_code'), '');
    v_location_code := nullif(trim(v_row->>'location_code'), '');

    if v_customer_code is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'customer_code ไม่ระบุ');
      continue;
    end if;
    if v_customer_product_code is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'customer_product_code ไม่ระบุ');
      continue;
    end if;

    select id into v_customer_id from public.tgd_customers where customer_code = v_customer_code limit 1;
    if v_customer_id is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'ไม่พบลูกค้ารหัส: ' || v_customer_code);
      continue;
    end if;

    select id into v_product_id from public.tgd_customer_products
      where customer_id = v_customer_id and customer_product_code = v_customer_product_code
      limit 1;
    if v_product_id is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason',
        'ไม่พบสินค้ารหัส: ' || v_customer_product_code || ' ของลูกค้า ' || v_customer_code);
      continue;
    end if;

    v_location_id := null;
    if v_location_code is not null then
      select id into v_location_id from public.tgd_locations where location_code = v_location_code limit 1;
      if v_location_id is null then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'ไม่พบ location_code: ' || v_location_code);
        continue;
      end if;
    end if;

    update public.tgd_customer_products
      set default_location_id = v_location_id, updated_at = now()
      where id = v_product_id;

    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object('processed', v_processed, 'errors', v_errors);
end;
$$;

notify pgrst, 'reload schema';
commit;

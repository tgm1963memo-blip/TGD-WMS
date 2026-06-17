-- 054_tgd_wms_item_master_and_request_line_extensions.sql
-- Item master fields (Argent, billing basis), request line dates, admin-only catalog writes.

begin;

alter table public.tgd_customer_products
  add column if not exists argent_type text,
  add column if not exists storage_charge_basis text;

alter table public.tgd_customer_products
  drop constraint if exists tgd_customer_products_argent_type_check;
alter table public.tgd_customer_products
  add constraint tgd_customer_products_argent_type_check check (
    argent_type is null or argent_type in ('ARGENT', 'NON_ARGENT')
  );

alter table public.tgd_customer_products
  drop constraint if exists tgd_customer_products_storage_charge_basis_check;
alter table public.tgd_customer_products
  add constraint tgd_customer_products_storage_charge_basis_check check (
    storage_charge_basis is null or storage_charge_basis in ('WEIGHT', 'PALLET')
  );

alter table public.tgd_products
  add column if not exists argent_type text,
  add column if not exists storage_charge_basis text;

alter table public.tgd_customer_deposit_request_lines
  add column if not exists mfg_date date,
  add column if not exists exp_date date;

alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists mfg_date date,
  add column if not exists exp_date date;

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

  if v_profile.role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    raise exception 'Only admin or warehouse staff can manage customer product catalog';
  end if;

  v_customer_id := p_customer_id;
  if v_customer_id is null then
    raise exception 'customer_id is required for catalog writes';
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

  if not exists (select 1 from public.tgd_customers c where c.id = v_customer_id) then
    raise exception 'customer_id not found';
  end if;

  if p_product_id is not null then
    update public.tgd_customer_products
    set customer_product_code = v_code,
        product_name = v_name,
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        internal_product_id = p_internal_product_id,
        uom = nullif(btrim(p_uom), ''),
        temperature_type = v_temp,
        argent_type = v_argent,
        storage_charge_basis = v_basis,
        note = nullif(btrim(p_note), ''),
        is_active = coalesce(p_is_active, true),
        updated_by_user_id = v_profile.id,
        updated_at = now()
    where id = p_product_id and customer_id = v_customer_id
    returning id into v_product_id;
    if not found then raise exception 'Customer product not found for this scope'; end if;
    v_action := 'UPDATE_CUSTOMER_PRODUCT';
  else
    insert into public.tgd_customer_products (
      customer_id, customer_product_code, product_name,
      internal_product_code, internal_product_id, uom, temperature_type,
      argent_type, storage_charge_basis, note, is_active,
      created_by_user_id, updated_by_user_id
    ) values (
      v_customer_id, v_code, v_name,
      nullif(btrim(p_internal_product_code), ''), p_internal_product_id,
      nullif(btrim(p_uom), ''), v_temp, v_argent, v_basis,
      nullif(btrim(p_note), ''), coalesce(p_is_active, true),
      v_profile.id, v_profile.id
    )
    returning id into v_product_id;
    v_action := 'INSERT_CUSTOMER_PRODUCT';
  end if;

  return jsonb_build_object('id', v_product_id, 'customer_id', v_customer_id, 'action', v_action);
end;
$$;

create or replace function public.tgd_upsert_customer_deposit_request_line(
  p_request_id uuid,
  p_line_id uuid default null,
  p_line_no integer default null,
  p_customer_product_code text default null,
  p_internal_product_code text default null,
  p_product_id uuid default null,
  p_product_name text default null,
  p_lot_no text default null,
  p_mfg_date date default null,
  p_exp_date date default null,
  p_expected_qty numeric default null,
  p_expected_boxes numeric default null,
  p_expected_weight numeric default null,
  p_uom text default null,
  p_temperature_type text default null,
  p_note text default null
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
  v_line_id uuid;
  v_line_no integer;
  v_action text;
  v_temp text := nullif(btrim(p_temperature_type), '');
  v_catalog record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;

  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status into v_document
  from public.tgd_customer_deposit_requests d where d.id = p_request_id for update;

  if not found then raise exception 'Customer deposit request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'DRAFT' then raise exception 'Deposit request must be DRAFT before line edit'; end if;

  if v_temp is null and nullif(btrim(p_customer_product_code), '') is not null then
    select cp.temperature_type into v_catalog
    from public.tgd_customer_products cp
    where cp.customer_id = v_document.customer_id
      and lower(cp.customer_product_code) = lower(btrim(p_customer_product_code))
      and cp.is_active = true
    limit 1;
    v_temp := v_catalog.temperature_type;
  end if;

  if p_line_id is not null then
    update public.tgd_customer_deposit_request_lines
    set line_no = coalesce(p_line_no, line_no),
        customer_product_code = nullif(btrim(p_customer_product_code), ''),
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        product_id = p_product_id,
        product_name = nullif(btrim(p_product_name), ''),
        lot_no = nullif(btrim(p_lot_no), ''),
        mfg_date = p_mfg_date,
        exp_date = p_exp_date,
        expected_qty = p_expected_qty,
        expected_boxes = p_expected_boxes,
        expected_weight = p_expected_weight,
        uom = nullif(btrim(p_uom), ''),
        temperature_type = v_temp,
        note = nullif(btrim(p_note), '')
    where id = p_line_id and deposit_request_id = v_document.id
    returning id, line_no into v_line_id, v_line_no;
    if not found then raise exception 'Deposit request line not found'; end if;
    v_action := 'UPDATE_LINE';
  else
    if p_line_no is null then
      select coalesce(max(l.line_no), 0) + 1 into v_line_no
      from public.tgd_customer_deposit_request_lines l where l.deposit_request_id = v_document.id;
    else
      v_line_no := p_line_no;
    end if;

    insert into public.tgd_customer_deposit_request_lines (
      deposit_request_id, line_no, customer_product_code, internal_product_code,
      product_id, product_name, lot_no, mfg_date, exp_date,
      expected_qty, expected_boxes, expected_weight, uom, temperature_type, note
    ) values (
      v_document.id, v_line_no,
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_mfg_date, p_exp_date,
      p_expected_qty, p_expected_boxes, p_expected_weight,
      nullif(btrim(p_uom), ''), v_temp, nullif(btrim(p_note), '')
    ) returning id into v_line_id;
    v_action := 'INSERT_LINE';
  end if;

  return jsonb_build_object('id', v_document.id, 'line_id', v_line_id, 'line_no', v_line_no, 'status', v_document.status, 'action', v_action);
end;
$$;

create or replace function public.tgd_upsert_customer_withdrawal_request_line(
  p_request_id uuid,
  p_line_id uuid default null,
  p_line_no integer default null,
  p_source_customer_deposit_request_id uuid default null,
  p_source_lot_no text default null,
  p_customer_product_code text default null,
  p_internal_product_code text default null,
  p_product_id uuid default null,
  p_product_name text default null,
  p_lot_no text default null,
  p_mfg_date date default null,
  p_exp_date date default null,
  p_requested_qty numeric default null,
  p_requested_boxes numeric default null,
  p_requested_weight numeric default null,
  p_uom text default null,
  p_picking_rule text default 'FEFO',
  p_note text default null
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
  v_line_id uuid;
  v_line_no integer;
  v_picking_rule text := upper(nullif(btrim(p_picking_rule), ''));
  v_action text;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;

  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  if v_picking_rule not in ('FEFO', 'SPECIFIC_DEPOSIT', 'SPECIFIC_LOT') then
    raise exception 'picking_rule must be FEFO, SPECIFIC_DEPOSIT, or SPECIFIC_LOT';
  end if;

  select w.id, w.customer_id, w.status into v_document
  from public.tgd_customer_withdrawal_requests w where w.id = p_request_id for update;

  if not found then raise exception 'Customer withdrawal request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'WITHDRAWAL_DRAFT' then raise exception 'Withdrawal request must be WITHDRAWAL_DRAFT before line edit'; end if;

  if p_line_id is not null then
    update public.tgd_customer_withdrawal_request_lines
    set line_no = coalesce(p_line_no, line_no),
        source_customer_deposit_request_id = p_source_customer_deposit_request_id,
        source_lot_no = nullif(btrim(p_source_lot_no), ''),
        customer_product_code = nullif(btrim(p_customer_product_code), ''),
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        product_id = p_product_id,
        product_name = nullif(btrim(p_product_name), ''),
        lot_no = nullif(btrim(p_lot_no), ''),
        mfg_date = p_mfg_date,
        exp_date = p_exp_date,
        requested_qty = p_requested_qty,
        requested_boxes = p_requested_boxes,
        requested_weight = p_requested_weight,
        uom = nullif(btrim(p_uom), ''),
        picking_rule = v_picking_rule,
        note = nullif(btrim(p_note), '')
    where id = p_line_id and withdrawal_request_id = v_document.id
    returning id, line_no into v_line_id, v_line_no;
    if not found then raise exception 'Withdrawal request line not found'; end if;
    v_action := 'UPDATE_LINE';
  else
    if p_line_no is null then
      select coalesce(max(l.line_no), 0) + 1 into v_line_no
      from public.tgd_customer_withdrawal_request_lines l where l.withdrawal_request_id = v_document.id;
    else
      v_line_no := p_line_no;
    end if;

    insert into public.tgd_customer_withdrawal_request_lines (
      withdrawal_request_id, line_no,
      source_customer_deposit_request_id, source_lot_no,
      customer_product_code, internal_product_code, product_id, product_name,
      lot_no, mfg_date, exp_date,
      requested_qty, requested_boxes, requested_weight, uom, picking_rule, note
    ) values (
      v_document.id, v_line_no,
      p_source_customer_deposit_request_id, nullif(btrim(p_source_lot_no), ''),
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_mfg_date, p_exp_date,
      p_requested_qty, p_requested_boxes, p_requested_weight,
      nullif(btrim(p_uom), ''), v_picking_rule, nullif(btrim(p_note), '')
    ) returning id into v_line_id;
    v_action := 'INSERT_LINE';
  end if;

  return jsonb_build_object('id', v_document.id, 'line_id', v_line_id, 'line_no', v_line_no, 'status', v_document.status, 'action', v_action);
end;
$$;

revoke all on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, text, text, boolean) to authenticated;

commit;

-- Persist which packaging unit (BOXES, or a tgd_customer_product_units
-- entry like CASE/PACK) and count the customer actually typed on a deposit/
-- withdrawal line, snapshotted by value (unit_code text + qty numeric) --
-- not an FK to tgd_customer_product_units. Same reasoning as weight_per_box
-- already being copied onto the line rather than referenced live (see
-- 20260710090000_lot_weight_per_box_fallback.sql): if a unit's conversion
-- factor is edited or deactivated later, historical lines must keep
-- showing exactly what was entered and what it resolved to at the time.
--
-- Mirrors pack_entry_mode's own persistence fix
-- (20260730090000/20260731130000) exactly -- same drop-then-recreate arity
-- change on both line upsert RPCs, trailing 2 new params.

begin;

alter table public.tgd_customer_deposit_request_lines
  add column if not exists entry_unit_code text,
  add column if not exists entry_unit_qty numeric;

alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists entry_unit_code text,
  add column if not exists entry_unit_qty numeric;

-- ---------------------------------------------------------------------------
-- tgd_upsert_customer_deposit_request_line: +2 trailing params
-- ---------------------------------------------------------------------------

drop function if exists public.tgd_upsert_customer_deposit_request_line(
  uuid, uuid, integer, text, text, uuid, text, text, date, date,
  numeric, numeric, numeric, numeric, text, text, text, text
);

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
  p_weight_per_box numeric default null,
  p_uom text default null,
  p_temperature_type text default null,
  p_note text default null,
  p_pack_entry_mode text default null,
  p_entry_unit_code text default null,
  p_entry_unit_qty numeric default null
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
  v_pack_entry_mode text := upper(nullif(btrim(coalesce(p_pack_entry_mode, '')), ''));
  v_entry_unit_code text := upper(nullif(btrim(coalesce(p_entry_unit_code, '')), ''));
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  if v_pack_entry_mode is not null and v_pack_entry_mode not in ('BOXES', 'WEIGHT') then
    raise exception 'pack_entry_mode must be BOXES or WEIGHT';
  end if;

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
        weight_per_box = p_weight_per_box,
        uom = nullif(btrim(p_uom), ''),
        temperature_type = v_temp,
        note = nullif(btrim(p_note), ''),
        pack_entry_mode = coalesce(v_pack_entry_mode, pack_entry_mode),
        entry_unit_code = v_entry_unit_code,
        entry_unit_qty = p_entry_unit_qty
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
      expected_qty, expected_boxes, expected_weight, weight_per_box, uom, temperature_type, note,
      pack_entry_mode, entry_unit_code, entry_unit_qty
    ) values (
      v_document.id, v_line_no,
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_mfg_date, p_exp_date,
      p_expected_qty, p_expected_boxes, p_expected_weight, p_weight_per_box,
      nullif(btrim(p_uom), ''), v_temp, nullif(btrim(p_note), ''),
      coalesce(v_pack_entry_mode, 'BOXES'), v_entry_unit_code, p_entry_unit_qty
    ) returning id into v_line_id;
    v_action := 'INSERT_LINE';
  end if;

  return (
    select jsonb_build_object(
      'id', l.id,
      'line_id', l.id,
      'deposit_request_id', l.deposit_request_id,
      'line_no', l.line_no,
      'customer_product_code', l.customer_product_code,
      'internal_product_code', l.internal_product_code,
      'product_id', l.product_id,
      'product_name', l.product_name,
      'lot_no', l.lot_no,
      'mfg_date', l.mfg_date,
      'exp_date', l.exp_date,
      'expected_qty', l.expected_qty,
      'expected_boxes', l.expected_boxes,
      'expected_weight', l.expected_weight,
      'weight_per_box', l.weight_per_box,
      'uom', l.uom,
      'temperature_type', l.temperature_type,
      'note', l.note,
      'pack_entry_mode', l.pack_entry_mode,
      'entry_unit_code', l.entry_unit_code,
      'entry_unit_qty', l.entry_unit_qty,
      'action', v_action
    )
    from public.tgd_customer_deposit_request_lines l
    where l.id = v_line_id
  );
end;
$$;

grant execute on function public.tgd_upsert_customer_deposit_request_line(
  uuid, uuid, integer, text, text, uuid, text, text, date, date,
  numeric, numeric, numeric, numeric, text, text, text, text, text, numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- tgd_upsert_customer_withdrawal_request_line: +2 trailing params
-- ---------------------------------------------------------------------------

drop function if exists public.tgd_upsert_customer_withdrawal_request_line(
  uuid, uuid, integer, uuid, uuid, text, text, text, text, uuid, text, text,
  date, date, numeric, numeric, numeric, text, text, text, text
);

create or replace function public.tgd_upsert_customer_withdrawal_request_line(
  p_request_id uuid,
  p_line_id uuid default null,
  p_line_no integer default null,
  p_source_customer_deposit_request_id uuid default null,
  p_source_customer_deposit_request_line_id uuid default null,
  p_source_lot_no text default null,
  p_tracking_code text default null,
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
  p_note text default null,
  p_pack_entry_mode text default null,
  p_entry_unit_code text default null,
  p_entry_unit_qty numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_line_id uuid;
  v_line_no integer;
  v_picking_rule text := upper(nullif(btrim(p_picking_rule), ''));
  v_action text;
  v_deposit_line record;
  v_max_boxes numeric;
  v_max_weight numeric;
  v_claimed_boxes numeric;
  v_claimed_weight numeric;
  v_target_exists boolean := false;
  v_pack_entry_mode text := upper(nullif(btrim(coalesce(p_pack_entry_mode, '')), ''));
  v_entry_unit_code text := upper(nullif(btrim(coalesce(p_entry_unit_code, '')), ''));
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

  if v_pack_entry_mode is not null and v_pack_entry_mode not in ('BOXES', 'WEIGHT') then
    raise exception 'pack_entry_mode must be BOXES or WEIGHT';
  end if;

  select w.id, w.customer_id, w.status into v_document
  from public.tgd_customer_withdrawal_requests w where w.id = p_request_id for update;

  if not found then raise exception 'Customer withdrawal request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'WITHDRAWAL_DRAFT' then raise exception 'Withdrawal request must be WITHDRAWAL_DRAFT before line edit'; end if;

  if p_source_customer_deposit_request_line_id is not null or p_tracking_code is not null then
    select dl.id, dl.actual_boxes, dl.actual_weight, dl.expected_boxes, dl.expected_weight
    into v_deposit_line
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dr.customer_id = v_document.customer_id
      and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
      and (
        (p_source_customer_deposit_request_line_id is not null and dl.id = p_source_customer_deposit_request_line_id)
        or (p_tracking_code is not null and dl.tracking_code = p_tracking_code)
      )
    limit 1
    for update of dl;

    if found then
      v_max_boxes := coalesce(v_deposit_line.actual_boxes, v_deposit_line.expected_boxes, 0);
      v_max_weight := coalesce(v_deposit_line.actual_weight, v_deposit_line.expected_weight, 0);

      select coalesce(sum(coalesce(wl.picked_boxes, wl.requested_boxes)), 0),
             coalesce(sum(coalesce(wl.picked_weight, wl.requested_weight)), 0)
      into v_claimed_boxes, v_claimed_weight
      from public.tgd_customer_withdrawal_request_lines wl
      join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
      where wr.status <> 'CANCELLED'
        and wl.id <> coalesce(p_line_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          wl.source_customer_deposit_request_line_id = v_deposit_line.id
          or (p_tracking_code is not null and wl.tracking_code = p_tracking_code)
        );

      if v_max_boxes > 0 and p_requested_boxes is not null
         and p_requested_boxes > (v_max_boxes - v_claimed_boxes) then
        raise exception 'Requested boxes (%) exceed remaining balance (%) for this deposit line/tracking code',
          p_requested_boxes, greatest(0, v_max_boxes - v_claimed_boxes);
      end if;

      if v_max_weight > 0 and p_requested_weight is not null
         and p_requested_weight > (v_max_weight - v_claimed_weight) then
        raise exception 'Requested weight (%) exceeds remaining balance (%) for this deposit line/tracking code',
          p_requested_weight, greatest(0, v_max_weight - v_claimed_weight);
      end if;
    end if;
  end if;

  if p_line_id is not null then
    select exists(
      select 1 from public.tgd_customer_withdrawal_request_lines
      where id = p_line_id and withdrawal_request_id = v_document.id
    ) into v_target_exists;
  end if;

  if p_line_id is not null and v_target_exists then
    -- UPDATE existing line by id
    update public.tgd_customer_withdrawal_request_lines
    set line_no = coalesce(p_line_no, line_no),
        source_customer_deposit_request_id = p_source_customer_deposit_request_id,
        source_customer_deposit_request_line_id = p_source_customer_deposit_request_line_id,
        source_lot_no = nullif(btrim(p_source_lot_no), ''),
        tracking_code = nullif(btrim(p_tracking_code), ''),
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
        note = nullif(btrim(p_note), ''),
        pack_entry_mode = coalesce(v_pack_entry_mode, pack_entry_mode),
        entry_unit_code = v_entry_unit_code,
        entry_unit_qty = p_entry_unit_qty
    where id = p_line_id and withdrawal_request_id = v_document.id
    returning id, line_no into v_line_id, v_line_no;

    v_action := 'UPDATE_LINE';
  else
    -- INSERT new line, or UPDATE if (withdrawal_request_id, line_no) already exists (idempotent retry).
    -- Also reached when p_line_id was given but no longer points to a real
    -- row on this request (stale reference from a concurrent edit).
    if p_line_no is null then
      select coalesce(max(l.line_no), 0) + 1 into v_line_no
      from public.tgd_customer_withdrawal_request_lines l where l.withdrawal_request_id = v_document.id;
    else
      v_line_no := p_line_no;
    end if;

    insert into public.tgd_customer_withdrawal_request_lines (
      withdrawal_request_id, line_no,
      source_customer_deposit_request_id, source_customer_deposit_request_line_id,
      source_lot_no, tracking_code,
      customer_product_code, internal_product_code, product_id, product_name,
      lot_no, mfg_date, exp_date,
      requested_qty, requested_boxes, requested_weight, uom, picking_rule, note,
      pack_entry_mode, entry_unit_code, entry_unit_qty
    ) values (
      v_document.id, v_line_no,
      p_source_customer_deposit_request_id, p_source_customer_deposit_request_line_id,
      nullif(btrim(p_source_lot_no), ''), nullif(btrim(p_tracking_code), ''),
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_mfg_date, p_exp_date,
      p_requested_qty, p_requested_boxes, p_requested_weight,
      nullif(btrim(p_uom), ''), v_picking_rule, nullif(btrim(p_note), ''),
      coalesce(v_pack_entry_mode, 'WEIGHT'), v_entry_unit_code, p_entry_unit_qty
    )
    on conflict (withdrawal_request_id, line_no) do update set
      source_customer_deposit_request_id = excluded.source_customer_deposit_request_id,
      source_customer_deposit_request_line_id = excluded.source_customer_deposit_request_line_id,
      source_lot_no = excluded.source_lot_no,
      tracking_code = excluded.tracking_code,
      customer_product_code = excluded.customer_product_code,
      internal_product_code = excluded.internal_product_code,
      product_id = excluded.product_id,
      product_name = excluded.product_name,
      lot_no = excluded.lot_no,
      mfg_date = excluded.mfg_date,
      exp_date = excluded.exp_date,
      requested_qty = excluded.requested_qty,
      requested_boxes = excluded.requested_boxes,
      requested_weight = excluded.requested_weight,
      uom = excluded.uom,
      picking_rule = excluded.picking_rule,
      note = excluded.note,
      pack_entry_mode = excluded.pack_entry_mode,
      entry_unit_code = excluded.entry_unit_code,
      entry_unit_qty = excluded.entry_unit_qty
    returning id into v_line_id;

    v_action := 'UPSERT_LINE';
  end if;

  return jsonb_build_object(
    'id', v_line_id,
    'line_id', v_line_id,
    'line_no', v_line_no,
    'status', v_document.status,
    'action', v_action,
    'pack_entry_mode', v_pack_entry_mode,
    'entry_unit_code', v_entry_unit_code,
    'entry_unit_qty', p_entry_unit_qty
  );
end;
$function$;

grant execute on function public.tgd_upsert_customer_withdrawal_request_line(
  uuid, uuid, integer, uuid, uuid, text, text, text, text, uuid, text, text,
  date, date, numeric, numeric, numeric, text, text, text, text, text, numeric
) to authenticated;

notify pgrst, 'reload schema';

commit;

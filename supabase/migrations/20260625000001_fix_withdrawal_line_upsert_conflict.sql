-- Fix: Add ON CONFLICT to tgd_upsert_customer_withdrawal_request_line
-- Prevents duplicate key error when double-submit or retry occurs for the same (withdrawal_request_id, line_no).

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
    -- UPDATE existing line by id
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
    -- INSERT new line, or UPDATE if (withdrawal_request_id, line_no) already exists (idempotent retry)
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
    )
    on conflict (withdrawal_request_id, line_no) do update set
      source_customer_deposit_request_id = excluded.source_customer_deposit_request_id,
      source_lot_no = excluded.source_lot_no,
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
      note = excluded.note
    returning id into v_line_id;

    v_action := 'UPSERT_LINE';
  end if;

  return jsonb_build_object(
    'id', v_document.id,
    'line_id', v_line_id,
    'line_no', v_line_no,
    'status', v_document.status,
    'action', v_action
  );
end;
$$;

grant execute on function public.tgd_upsert_customer_withdrawal_request_line(
  uuid, uuid, integer, uuid, text, text, text, uuid, text, text, date, date,
  numeric, numeric, numeric, text, text, text
) to authenticated;

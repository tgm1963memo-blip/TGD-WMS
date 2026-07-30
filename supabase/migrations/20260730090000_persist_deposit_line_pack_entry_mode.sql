-- "วิธีกรอก" (BOXES vs WEIGHT entry mode) on a deposit line was only ever a
-- client-side React field (pack_entry_mode, see
-- customerDepositLineDefaults.js / customerDepositPackCalcUtils.js) —
-- never sent to tgd_upsert_customer_deposit_request_line, never a column
-- on tgd_customer_deposit_request_lines. Saving a draft then reopening it
-- for edit (CustomerDepositRequestCreatePage.jsx) hardcoded
-- pack_entry_mode: 'BOXES' for every line regardless of what the customer
-- actually selected, since there was nothing to restore it from — the
-- customer's saved WEIGHT-entry selection silently reverted to BOXES on
-- reload. Beyond the toggle looking wrong, if the customer then touched
-- any field on a reopened WEIGHT-mode line, the BOXES-mode auto-calc
-- (applyPackFieldChange) would recompute expected_weight FROM
-- expected_boxes × weight_per_box, silently overwriting the originally
-- precise, directly-entered weight.
--
-- While rewriting this function's return value, also fixed a second,
-- separate bug found by inspecting every caller: the function returned
-- 'id' = v_document.id (the DEPOSIT REQUEST's id), but both callers —
-- CustomerDepositRequestCreatePage.jsx's `lineResult.data.id` (used to
-- learn a newly-created line's own id for the next save) and
-- HandheldPage.jsx's `upsertResult.data?.id` (used to immediately call
-- tgd_record_deposit_line_actual_receipt(newLineId, ...) right after
-- adding an extra unlisted item during receiving) — both need the LINE's
-- id, not the request's. The Handheld case is live-broken today: it
-- passes the request id where tgd_record_deposit_line_actual_receipt
-- expects a line id, which always raises "Deposit request line not
-- found" — silently, since that call's result is never checked — so an
-- extra item added during receiving is created but its actual
-- boxes/weight are never recorded. Now returns the actual line's id
-- under both 'id' and 'line_id'.

begin;

alter table public.tgd_customer_deposit_request_lines
  add column if not exists pack_entry_mode text not null default 'BOXES'
  check (pack_entry_mode in ('BOXES', 'WEIGHT'));

-- Adding a trailing parameter changes the argument-type list — drop the
-- old 17-arg signature first (same pattern as every other RPC-arity
-- change this session).
drop function if exists public.tgd_upsert_customer_deposit_request_line(
  uuid, uuid, integer, text, text, uuid, text, text, date, date,
  numeric, numeric, numeric, numeric, text, text, text
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
  p_pack_entry_mode text default null
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
        pack_entry_mode = coalesce(v_pack_entry_mode, pack_entry_mode)
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
      pack_entry_mode
    ) values (
      v_document.id, v_line_no,
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_mfg_date, p_exp_date,
      p_expected_qty, p_expected_boxes, p_expected_weight, p_weight_per_box,
      nullif(btrim(p_uom), ''), v_temp, nullif(btrim(p_note), ''),
      coalesce(v_pack_entry_mode, 'BOXES')
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
      'action', v_action
    )
    from public.tgd_customer_deposit_request_lines l
    where l.id = v_line_id
  );
end;
$$;

grant execute on function public.tgd_upsert_customer_deposit_request_line(
  uuid, uuid, integer, text, text, uuid, text, text, date, date,
  numeric, numeric, numeric, numeric, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';

commit;

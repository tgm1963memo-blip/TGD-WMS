-- Migration 106: Persist tracking_code on withdrawal lines for scan-to-pick
--
-- tgd_customer_withdrawal_request_lines already had a
-- source_customer_deposit_request_line_id column (since migration 040) but no
-- RPC ever wrote to it, so it was always null. This migration:
--   1. Adds a denormalized tracking_code column (fast lookup on the handheld
--      scanner without a join, and indexable).
--   2. Extends tgd_upsert_customer_withdrawal_request_line to accept and
--      persist both source_customer_deposit_request_line_id and tracking_code.
--
-- Business flow: staff pick a source deposit LOT by its tracking code when
-- creating a withdrawal request (see CustomerWithdrawalLinesTable.jsx). The
-- resolved tracking code is now saved on the withdrawal line, so scanning the
-- same tracking-code sticker QR during picking (PickingWorkflow in the
-- handheld app) can match the line directly and mark it picked.

begin;

alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists tracking_code text;

create index if not exists tgd_customer_withdrawal_request_lines_tracking_code_idx
  on public.tgd_customer_withdrawal_request_lines (tracking_code)
  where tracking_code is not null;

-- Two stale overloads have accumulated over past migrations that each added
-- params via CREATE OR REPLACE without dropping the shorter previous
-- signature first. Drop every known prior signature so only the current one
-- remains (named-parameter RPC calls already resolve to the right one
-- regardless, but leaving dead overloads around is confusing/risky).
drop function if exists public.tgd_upsert_customer_withdrawal_request_line(
  uuid, uuid, integer, uuid, text, text, text, uuid, text, numeric, numeric, numeric, text, text, text
);
drop function if exists public.tgd_upsert_customer_withdrawal_request_line(
  uuid, uuid, integer, uuid, text, text, text, uuid, text, text, date, date,
  numeric, numeric, numeric, text, text, text
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
      source_customer_deposit_request_id, source_customer_deposit_request_line_id,
      source_lot_no, tracking_code,
      customer_product_code, internal_product_code, product_id, product_name,
      lot_no, mfg_date, exp_date,
      requested_qty, requested_boxes, requested_weight, uom, picking_rule, note
    ) values (
      v_document.id, v_line_no,
      p_source_customer_deposit_request_id, p_source_customer_deposit_request_line_id,
      nullif(btrim(p_source_lot_no), ''), nullif(btrim(p_tracking_code), ''),
      nullif(btrim(p_customer_product_code), ''), nullif(btrim(p_internal_product_code), ''),
      p_product_id, nullif(btrim(p_product_name), ''),
      nullif(btrim(p_lot_no), ''), p_mfg_date, p_exp_date,
      p_requested_qty, p_requested_boxes, p_requested_weight,
      nullif(btrim(p_uom), ''), v_picking_rule, nullif(btrim(p_note), '')
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
  uuid, uuid, integer, uuid, uuid, text, text, text, text, uuid, text, text, date, date,
  numeric, numeric, numeric, text, text, text
) to authenticated;

-- Backfill: existing withdrawal lines predate this column, so
-- source_customer_deposit_request_line_id is always null on them. Fill in
-- tracking_code only where it resolves unambiguously — a single deposit line
-- in the same source deposit request sharing this line's LOT number — so an
-- in-flight WAREHOUSE_PICKING request can also be scanned by tracking code.
update public.tgd_customer_withdrawal_request_lines wl
set tracking_code = matched.tracking_code
from (
  select
    dl.deposit_request_id,
    dl.lot_no,
    min(dl.tracking_code) as tracking_code,
    count(*) as match_count
  from public.tgd_customer_deposit_request_lines dl
  where dl.tracking_code is not null and dl.lot_no is not null
  group by dl.deposit_request_id, dl.lot_no
  having count(*) = 1
) matched
where wl.tracking_code is null
  and wl.source_customer_deposit_request_id = matched.deposit_request_id
  and wl.lot_no = matched.lot_no;

commit;

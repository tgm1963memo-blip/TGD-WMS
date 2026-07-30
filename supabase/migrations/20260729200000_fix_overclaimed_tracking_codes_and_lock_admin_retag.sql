-- Investigated the reported "lot 175 fully withdrawn but balance still
-- shows remaining" for product 10385-7 by auditing EVERY confirmed
-- deposit line system-wide against its non-cancelled withdrawal claims
-- (same dual-match rule as getDepositInventoryLines: direct
-- source_customer_deposit_request_line_id, else tracking_code). Found 4
-- deposit lines system-wide where claimed boxes/weight exceed what was
-- ever deposited — all belonging to customer C002 (บริษัท ไทย-เยอรมัน มีท
-- โปรดักท์), all from withdrawals dated before 2026-07-13 (the date
-- 20260713090000_lock_withdrawal_line_against_deposit_balance.sql added a
-- server-side lock preventing exactly this — these are historical
-- residue from before that fix existed, not an ongoing live gap in that
-- specific path).
--
-- Two of the four have an exact, unambiguous explanation and fix: a
-- sibling deposit line in the SAME lot with precisely the missing
-- quantity sitting completely unclaimed — meaning the withdrawal was very
-- likely picked from that sibling batch but recorded against the wrong
-- tracking code (both lines here were only ever matched via the
-- tracking_code FALLBACK, never a direct id link, consistent with a
-- mis-scanned/mis-recorded code rather than a deliberate link):
--
--   Product 10385-7, lot 175: CWR-20260704-0012's two 200-box lines were
--   tagged FR260704002 (which only ever held 100 boxes, already fully and
--   correctly claimed by a DIRECTLY-linked CWR-20260709-0001 line) —
--   retagged to FR260701111, the lot's other batch (400 boxes), which had
--   zero claims recorded against it at all. 200+200 = 400 reconciles
--   exactly.
--
--   Product 10154-10, lot 138: CWR-20260703-0003's 93-box line was tagged
--   FR260630026 (100 boxes, already fully claimed by CWR-20260703-0001) —
--   retagged to FR260630027, the lot's sibling batch (93 boxes, zero
--   claims). Reconciles exactly.
--
-- The other 2 over-claimed lines found (RPC058 lot 135/24; product 10154
-- lot 163) do NOT have an equally unambiguous single fix — either the
-- claims are direct id links (not a tracking-code mismatch) or more than
-- one sibling batch could plausibly be the true source — reported to the
-- customer separately rather than guessed at here.

begin;

update public.tgd_customer_withdrawal_request_lines
set tracking_code = 'FR260701111',
    source_customer_deposit_request_line_id = '43cfda38-3b86-4d71-8527-e761042a055b',
    source_customer_deposit_request_id = '93e5b112-6daa-46b7-af4d-69aafc700f1c'
where id in ('51e717de-eac4-428a-ace3-f0a82204f798', '1e8140e9-b6a3-438f-8181-015767d7a561')
  and tracking_code = 'FR260704002';

update public.tgd_customer_withdrawal_request_lines
set tracking_code = 'FR260630027',
    source_customer_deposit_request_line_id = 'ecc568e1-492b-413f-a2af-fcf0b823d0d4',
    source_customer_deposit_request_id = '59b41773-e09e-44f8-9de6-e011d813e7b9'
where id = 'd5ceeb8b-f371-478e-89a6-9ac0f1d98afa'
  and tracking_code = 'FR260630026';

-- Close the one remaining gap the audit surfaced: the admin "recode
-- tracking code" tool (used to retag a withdrawal line, including by this
-- very migration's fix above) had no balance check at all — unlike
-- tgd_upsert_customer_withdrawal_request_line's lock, retagging a line
-- onto an already fully-claimed tracking code here would silently
-- recreate the exact bug just fixed. Mirrors that same lock: sum every
-- OTHER non-cancelled line's coalesce(picked, requested) against the
-- target tracking code's deposit line and reject if this line's own
-- requested amount would push it over.
create or replace function public.tgd_admin_update_withdrawal_line_source(
  p_line_id               uuid,
  p_customer_product_code text default null,
  p_lot_no                text default null,
  p_tracking_code         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_line record;
  v_new_tracking_code text := nullif(btrim(coalesce(p_tracking_code, '')), '');
  v_source record;
  v_max_boxes numeric;
  v_max_weight numeric;
  v_claimed_boxes numeric;
  v_claimed_weight numeric;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') then
    raise exception 'Admin or warehouse role required';
  end if;

  select l.id, l.requested_boxes, l.requested_weight, wr.customer_id
  into v_line
  from public.tgd_customer_withdrawal_request_lines l
  join public.tgd_customer_withdrawal_requests wr on wr.id = l.withdrawal_request_id
  where l.id = p_line_id;

  if not found then
    raise exception 'Withdrawal request line not found';
  end if;

  if v_new_tracking_code is not null then
    select dl.id as deposit_line_id, dl.deposit_request_id, dl.customer_product_code, dl.lot_no,
           dl.actual_boxes, dl.actual_weight, dl.expected_boxes, dl.expected_weight, dr.customer_id
    into v_source
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dl.tracking_code = v_new_tracking_code;

    if not found then
      raise exception 'No deposit lot found with tracking code %', v_new_tracking_code;
    end if;

    if v_source.customer_id is distinct from v_line.customer_id then
      raise exception 'Tracking code % belongs to a different customer''s lot', v_new_tracking_code;
    end if;

    v_max_boxes := coalesce(v_source.actual_boxes, v_source.expected_boxes, 0);
    v_max_weight := coalesce(v_source.actual_weight, v_source.expected_weight, 0);

    select coalesce(sum(coalesce(wl.picked_boxes, wl.requested_boxes)), 0),
           coalesce(sum(coalesce(wl.picked_weight, wl.requested_weight)), 0)
    into v_claimed_boxes, v_claimed_weight
    from public.tgd_customer_withdrawal_request_lines wl
    join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
    where wr.status <> 'CANCELLED'
      and wl.id <> p_line_id
      and (
        wl.source_customer_deposit_request_line_id = v_source.deposit_line_id
        or wl.tracking_code = v_new_tracking_code
      );

    if v_max_boxes > 0 and v_line.requested_boxes is not null
       and v_line.requested_boxes > (v_max_boxes - v_claimed_boxes) then
      raise exception 'This line requests % boxes, which exceeds the remaining balance (%) for tracking code %',
        v_line.requested_boxes, greatest(0, v_max_boxes - v_claimed_boxes), v_new_tracking_code;
    end if;

    if v_max_weight > 0 and v_line.requested_weight is not null
       and v_line.requested_weight > (v_max_weight - v_claimed_weight) then
      raise exception 'This line requests % kg, which exceeds the remaining balance (%) for tracking code %',
        v_line.requested_weight, greatest(0, v_max_weight - v_claimed_weight), v_new_tracking_code;
    end if;
  end if;

  update public.tgd_customer_withdrawal_request_lines
  set customer_product_code = case
        when v_new_tracking_code is not null then v_source.customer_product_code
        else coalesce(nullif(btrim(coalesce(p_customer_product_code, '')), ''), customer_product_code)
      end,
      lot_no = case
        when v_new_tracking_code is not null then v_source.lot_no
        else coalesce(nullif(btrim(coalesce(p_lot_no, '')), ''), lot_no)
      end,
      tracking_code = case
        when p_tracking_code is not null then v_new_tracking_code
        else tracking_code
      end,
      source_customer_deposit_request_line_id = case
        when v_new_tracking_code is not null then v_source.deposit_line_id
        else source_customer_deposit_request_line_id
      end,
      source_customer_deposit_request_id = case
        when v_new_tracking_code is not null then v_source.deposit_request_id
        else source_customer_deposit_request_id
      end
  where id = p_line_id;

  return (
    select jsonb_build_object(
      'id', l.id,
      'customer_product_code', l.customer_product_code,
      'lot_no', l.lot_no,
      'tracking_code', l.tracking_code,
      'source_customer_deposit_request_line_id', l.source_customer_deposit_request_line_id,
      'source_customer_deposit_request_id', l.source_customer_deposit_request_id
    )
    from public.tgd_customer_withdrawal_request_lines l
    where l.id = p_line_id
  );
end;
$$;

do $$
declare
  v_remaining int;
begin
  select count(*) into v_remaining
  from public.tgd_customer_withdrawal_request_lines
  where id in ('51e717de-eac4-428a-ace3-f0a82204f798', '1e8140e9-b6a3-438f-8181-015767d7a561')
    and tracking_code <> 'FR260701111';
  if v_remaining > 0 then
    raise exception 'Retag to FR260701111 incomplete — % row(s) unchanged', v_remaining;
  end if;

  select count(*) into v_remaining
  from public.tgd_customer_withdrawal_request_lines
  where id = 'd5ceeb8b-f371-478e-89a6-9ac0f1d98afa'
    and tracking_code <> 'FR260630027';
  if v_remaining > 0 then
    raise exception 'Retag to FR260630027 incomplete';
  end if;
end $$;

commit;

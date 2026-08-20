-- pending_deposit_withdrawal_totals.sql
-- Adds 4 read-only, additive aggregate functions to power a "pending
-- deposit (รอรับ)" / "pending withdrawal (รอเบิก)" breakdown on the stock
-- balance pages. These are plain per-customer/per-product sums (no lot-level
-- FIFO/ambiguous-pool matching), deliberately NOT touching
-- tgd_get_customer_stock_balance / tgd_get_all_customer_stock_balances --
-- that pair's withdrawal-netting logic is an incident-hardened multi-CTE
-- FIFO allocation and re-deriving a pending/completed split out of it isn't
-- worth the risk for what is fundamentally two extra summary numbers.
--
-- "Pending deposit" = deposit lines whose request hasn't reached
-- RECEIVED_CONFIRMED/CUSTOMER_NOTIFIED yet (not yet counted in the balance
-- at all). "Pending withdrawal" = withdrawal lines whose request hasn't
-- reached COMPLETED yet but isn't CANCELLED either (already subtracted from
-- the live balance today, per
-- 20260731120000_stock_balance_nets_all_non_cancelled_withdrawals.sql, just
-- not broken out visibly).

begin;

create or replace function public.tgd_get_customer_pending_deposit_totals(p_customer_id uuid)
returns table(customer_product_code text, pending_boxes numeric, pending_weight numeric)
language sql
security definer
set search_path = public
as $$
  select dl.customer_product_code,
         sum(coalesce(dl.actual_boxes, dl.expected_boxes, 0))   as pending_boxes,
         sum(coalesce(dl.actual_weight, dl.expected_weight, 0)) as pending_weight
  from public.tgd_customer_deposit_request_lines dl
  join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
  where dr.customer_id = p_customer_id
    and dr.status = any(array[
      'SUBMITTED_BY_CUSTOMER','ADMIN_REVIEWING','ADMIN_ACCEPTED',
      'WAREHOUSE_RECEIVING','PALLETIZING','COUNT_VARIANCE_REVIEW','ADMIN_RECOUNT_REQUESTED'
    ])
  group by dl.customer_product_code;
$$;

comment on function public.tgd_get_customer_pending_deposit_totals(uuid) is
  'Per-product totals for deposit lines not yet counted in the customer''s stock balance (status before RECEIVED_CONFIRMED/CUSTOMER_NOTIFIED). Powers the "รอรับ" tile on the customer stock balance page.';

create or replace function public.tgd_get_customer_pending_withdrawal_totals(p_customer_id uuid)
returns table(customer_product_code text, pending_boxes numeric, pending_weight numeric)
language sql
security definer
set search_path = public
as $$
  select wl.customer_product_code,
         sum(coalesce(wl.picked_boxes, wl.requested_boxes))   as pending_boxes,
         sum(coalesce(wl.picked_weight, wl.requested_weight)) as pending_weight
  from public.tgd_customer_withdrawal_request_lines wl
  join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
  where wr.customer_id = p_customer_id
    and wr.status = any(array[
      'SUBMITTED_BY_CUSTOMER','ADMIN_REVIEWING','ADMIN_ACCEPTED','WAREHOUSE_PICKING'
    ])
  group by wl.customer_product_code;
$$;

comment on function public.tgd_get_customer_pending_withdrawal_totals(uuid) is
  'Per-product totals for withdrawal lines already subtracted from the customer''s live stock balance but not yet COMPLETED. Powers the "รอเบิก" tile on the customer stock balance page.';

create or replace function public.tgd_get_all_customer_pending_deposit_totals()
returns table(customer_id uuid, customer_product_code text, pending_boxes numeric, pending_weight numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.tgd_current_user_role() not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'Insufficient permissions to view all-customer pending deposit totals';
  end if;

  return query
  select dr.customer_id, dl.customer_product_code,
         sum(coalesce(dl.actual_boxes, dl.expected_boxes, 0))   as pending_boxes,
         sum(coalesce(dl.actual_weight, dl.expected_weight, 0)) as pending_weight
  from public.tgd_customer_deposit_request_lines dl
  join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
  where dr.status = any(array[
    'SUBMITTED_BY_CUSTOMER','ADMIN_REVIEWING','ADMIN_ACCEPTED',
    'WAREHOUSE_RECEIVING','PALLETIZING','COUNT_VARIANCE_REVIEW','ADMIN_RECOUNT_REQUESTED'
  ])
  group by dr.customer_id, dl.customer_product_code;
end;
$$;

comment on function public.tgd_get_all_customer_pending_deposit_totals() is
  'Admin/staff-only: per-customer, per-product pending-deposit totals across all customers. Powers the "รอรับเข้า" tile on the admin inventory balance page.';

create or replace function public.tgd_get_all_customer_pending_withdrawal_totals()
returns table(customer_id uuid, customer_product_code text, pending_boxes numeric, pending_weight numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.tgd_current_user_role() not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff') then
    raise exception 'Insufficient permissions to view all-customer pending withdrawal totals';
  end if;

  return query
  select wr.customer_id, wl.customer_product_code,
         sum(coalesce(wl.picked_boxes, wl.requested_boxes))   as pending_boxes,
         sum(coalesce(wl.picked_weight, wl.requested_weight)) as pending_weight
  from public.tgd_customer_withdrawal_request_lines wl
  join public.tgd_customer_withdrawal_requests wr on wr.id = wl.withdrawal_request_id
  where wr.status = any(array[
    'SUBMITTED_BY_CUSTOMER','ADMIN_REVIEWING','ADMIN_ACCEPTED','WAREHOUSE_PICKING'
  ])
  group by wr.customer_id, wl.customer_product_code;
end;
$$;

comment on function public.tgd_get_all_customer_pending_withdrawal_totals() is
  'Admin/staff-only: per-customer, per-product pending-withdrawal totals across all customers. Powers the "รอเบิก" tile on the admin inventory balance page.';

-- Matches the grant target already used for the sibling balance RPCs
-- (tgd_get_customer_stock_balance / tgd_get_all_customer_stock_balances) --
-- authenticated only, no anon access to balance-adjacent data.
grant execute on function public.tgd_get_customer_pending_deposit_totals(uuid) to authenticated;
grant execute on function public.tgd_get_customer_pending_withdrawal_totals(uuid) to authenticated;
grant execute on function public.tgd_get_all_customer_pending_deposit_totals() to authenticated;
grant execute on function public.tgd_get_all_customer_pending_withdrawal_totals() to authenticated;

notify pgrst, 'reload schema';

commit;

-- Effective "already picked" quantity per pallet allocation.
--
-- Pallet occupancy used to count only tgd_customer_withdrawal_line_pallet_picks.
-- Many withdrawals (3,000+ completed lines at the time of writing) were
-- picked with the older line-level flow, which sets picked_boxes /
-- picked_weight on the withdrawal line but never records which pallet the
-- goods came off, so fully-withdrawn stock kept showing on its pallet.
--
-- This view adds those unattributed line-level picks back in: for each
-- deposit line, the withdrawn quantity not covered by pallet picks is
-- deducted from that line's allocations in pallet order (FIFO). Withdrawal
-- lines are linked by source_customer_deposit_request_line_id, or by the
-- (unique) tracking_code when the source link is missing. Cancelled and
-- rejected withdrawals are ignored.

create or replace view public.tgd_deposit_line_location_picked
with (security_invoker = true)
as
with pallet_picks as (
  select deposit_line_location_id, sum(coalesce(boxes, 0)) boxes, sum(coalesce(weight, 0)) weight
  from public.tgd_customer_withdrawal_line_pallet_picks
  group by deposit_line_location_id
),
withdrawal_picks as (
  select
    coalesce(w.source_customer_deposit_request_line_id, d.id) as deposit_line_id,
    greatest(coalesce(w.picked_boxes, 0) - coalesce(pp.boxes, 0), 0) as extra_boxes,
    greatest(coalesce(w.picked_weight, 0) - coalesce(pp.weight, 0), 0) as extra_weight
  from public.tgd_customer_withdrawal_request_lines w
  join public.tgd_customer_withdrawal_requests r on r.id = w.withdrawal_request_id
  left join public.tgd_customer_deposit_request_lines d
    on w.source_customer_deposit_request_line_id is null
   and w.tracking_code is not null
   and d.tracking_code = w.tracking_code
  left join (
    select withdrawal_line_id, sum(coalesce(boxes, 0)) boxes, sum(coalesce(weight, 0)) weight
    from public.tgd_customer_withdrawal_line_pallet_picks
    group by withdrawal_line_id
  ) pp on pp.withdrawal_line_id = w.id
  where r.status not in ('CANCELLED', 'REJECTED', 'DRAFT')
    and (coalesce(w.picked_boxes, 0) > 0 or coalesce(w.picked_weight, 0) > 0)
),
line_extra as (
  select deposit_line_id, sum(extra_boxes) boxes, sum(extra_weight) weight
  from withdrawal_picks
  where deposit_line_id is not null
  group by deposit_line_id
),
alloc as (
  select
    a.id, a.line_id, a.location_id, a.pallet_no, a.boxes, a.weight,
    coalesce(pp.boxes, 0) as pallet_picked_boxes,
    coalesce(pp.weight, 0) as pallet_picked_weight,
    greatest(coalesce(a.boxes, 0) - coalesce(pp.boxes, 0), 0) as avail_boxes,
    greatest(coalesce(a.weight, 0) - coalesce(pp.weight, 0), 0) as avail_weight,
    coalesce(le.boxes, 0) as line_extra_boxes,
    coalesce(le.weight, 0) as line_extra_weight
  from public.tgd_customer_deposit_line_locations a
  left join pallet_picks pp on pp.deposit_line_location_id = a.id
  left join line_extra le on le.deposit_line_id = a.line_id
),
ordered as (
  select alloc.*,
    coalesce(sum(avail_boxes) over w_prev, 0) as boxes_before,
    coalesce(sum(avail_weight) over w_prev, 0) as weight_before
  from alloc
  window w_prev as (partition by line_id order by pallet_no, id rows between unbounded preceding and 1 preceding)
)
select
  id as allocation_id,
  line_id,
  location_id,
  pallet_no,
  boxes,
  weight,
  pallet_picked_boxes + least(avail_boxes, greatest(line_extra_boxes - boxes_before, 0)) as picked_boxes,
  pallet_picked_weight + least(avail_weight, greatest(line_extra_weight - weight_before, 0)) as picked_weight
from ordered;

grant select on public.tgd_deposit_line_location_picked to authenticated;

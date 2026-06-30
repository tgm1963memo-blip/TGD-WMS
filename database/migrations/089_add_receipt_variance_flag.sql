-- Migration 089: Add has_receipt_variance flag to deposit requests
-- Tracks whether confirmed receipts had quantity mismatches (actual != expected),
-- so list views can show a yellow warning without fetching all lines.

begin;

alter table public.tgd_customer_deposit_requests
  add column if not exists has_receipt_variance boolean not null default false;

-- Backfill existing confirmed rows: mark as variance if any line has actual != expected
update public.tgd_customer_deposit_requests dr
set has_receipt_variance = true
where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED')
  and exists (
    select 1
    from public.tgd_customer_deposit_request_lines l
    where l.deposit_request_id = dr.id
      and (
        (l.actual_boxes is not null and l.actual_boxes <> l.expected_boxes)
        or (l.actual_weight is not null and round(l.actual_weight::numeric, 3) <> round(l.expected_weight::numeric, 3))
      )
  );

-- Update tgd_review_customer_deposit_request to set has_receipt_variance on CONFIRM_RECEIPT
create or replace function public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
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
  v_decision text := upper(nullif(btrim(p_decision), ''));
  v_to_status text;
  v_receiving_id uuid;
  v_has_variance boolean := false;
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
    raise exception 'User profile not found';
  end if;

  if v_decision not in ('ACCEPT', 'REJECT', 'REVIEWING', 'CONFIRM_RECEIPT', 'COUNT_VARIANCE') then
    raise exception 'Decision must be ACCEPT, REJECT, REVIEWING, CONFIRM_RECEIPT, or COUNT_VARIANCE';
  end if;

  -- CONFIRM_RECEIPT and COUNT_VARIANCE allow warehouse roles
  if v_decision in ('CONFIRM_RECEIPT', 'COUNT_VARIANCE') then
    if v_profile.role not in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin') then
      raise exception 'Admin, accounting, or warehouse role required';
    end if;
  else
    if v_profile.role not in ('admin', 'accounting') then
      raise exception 'Admin or accounting role required to review a deposit request';
    end if;
  end if;

  select d.id, d.customer_id, d.status
  into v_document
  from public.tgd_customer_deposit_requests d
  where d.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer deposit request not found';
  end if;

  if v_decision = 'REVIEWING' and v_document.status = 'SUBMITTED_BY_CUSTOMER' then
    v_to_status := 'ADMIN_REVIEWING';
  elsif v_decision = 'ACCEPT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_ACCEPTED';
  elsif v_decision = 'REJECT' and v_document.status = 'ADMIN_REVIEWING' then
    v_to_status := 'ADMIN_REJECTED';
  elsif v_decision = 'CONFIRM_RECEIPT' and v_document.status in ('WAREHOUSE_RECEIVING', 'PALLETIZING', 'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED') then
    v_to_status := 'RECEIVED_CONFIRMED';

    -- Compute variance: any line where actual != expected
    select exists (
      select 1
      from public.tgd_customer_deposit_request_lines l
      where l.deposit_request_id = p_request_id
        and (
          (l.actual_boxes is not null and l.actual_boxes <> l.expected_boxes)
          or (l.actual_weight is not null and round(l.actual_weight::numeric, 3) <> round(l.expected_weight::numeric, 3))
        )
    ) into v_has_variance;

  elsif v_decision = 'COUNT_VARIANCE' and v_document.status in ('ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING') then
    v_to_status := 'COUNT_VARIANCE_REVIEW';
  else
    raise exception 'Invalid deposit review transition from % using %',
      v_document.status, v_decision;
  end if;

  update public.tgd_customer_deposit_requests
  set status = v_to_status,
      reviewed_by_user_id = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id else reviewed_by_user_id end,
      web_approved_by_email = case when v_decision = 'CONFIRM_RECEIPT' then v_profile.email else web_approved_by_email end,
      last_action_by_email = v_profile.email,
      last_action_at = now(),
      review_comment = coalesce(p_comment, review_comment),
      has_receipt_variance = case when v_decision = 'CONFIRM_RECEIPT' then v_has_variance else has_receipt_variance end
  where id = p_request_id;

  return jsonb_build_object('status', v_to_status, 'request_id', p_request_id);
end;
$$;

revoke all on function public.tgd_review_customer_deposit_request(uuid, text, text) from public;
grant execute on function public.tgd_review_customer_deposit_request(uuid, text, text) to authenticated;

commit;

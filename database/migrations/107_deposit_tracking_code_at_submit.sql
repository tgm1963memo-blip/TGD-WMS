-- Migration 107: Generate tracking_code at customer SUBMIT, not admin ACCEPT
--
-- Business change: tracking codes should exist as soon as the customer
-- submits the deposit request (DRAFT -> SUBMITTED_BY_CUSTOMER), not only
-- once admin accepts it. This lets staff reference/verify a LOT's tracking
-- code while the request is still pending review.
--
-- The ACCEPT-time assignment in tgd_review_customer_deposit_request (added
-- in migration 104) is left in place as a safety net — it only assigns to
-- lines that still have tracking_code IS NULL, so it's a no-op once this
-- migration's submit-time assignment has already run, but still covers any
-- line added to the request between submit and accept.
--
-- Also backfills tracking codes for already-submitted documents that were
-- never accepted yet (SUBMITTED_BY_CUSTOMER / ADMIN_REVIEWING) and so were
-- skipped by migration 105's accepted-or-later backfill.

begin;

create or replace function public.tgd_submit_customer_deposit_request(
  p_request_id uuid,
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
  v_request_no text;
  v_line record;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select d.id, d.customer_id, d.status, d.request_no into v_document
  from public.tgd_customer_deposit_requests d where d.id = p_request_id for update;
  if not found then raise exception 'Customer deposit request not found'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_document.customer_id);
  if v_document.status <> 'DRAFT' then raise exception 'Deposit request must be DRAFT before submission'; end if;

  v_request_no := v_document.request_no;

  update public.tgd_customer_deposit_requests
  set status = 'SUBMITTED_BY_CUSTOMER',
      submitted_by_user_id = v_profile.id,
      submitted_by_email = v_profile.email,
      submitted_at = now(),
      last_action_by_user_id = v_profile.id,
      last_action_by_email = v_profile.email,
      last_action_at = now()
  where id = v_document.id;

  -- Assign a tracking code to every line as soon as the customer submits,
  -- rather than waiting for admin to accept.
  for v_line in
    select dl.id, dl.temperature_type
    from public.tgd_customer_deposit_request_lines dl
    where dl.deposit_request_id = v_document.id
      and dl.tracking_code is null
    order by dl.line_no
  loop
    update public.tgd_customer_deposit_request_lines
    set tracking_code = public.tgd_generate_deposit_line_tracking_code(v_line.temperature_type, current_date)
    where id = v_line.id;
  end loop;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'SUBMIT', v_document.status, 'SUBMITTED_BY_CUSTOMER',
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(p_comment), '')
  );

  perform public.tgd_enqueue_customer_request_notifications(
    'CUSTOMER_DEPOSIT_REQUEST'::text, v_document.id, v_document.customer_id, v_request_no, v_profile.email
  );

  return jsonb_build_object(
    'id', v_document.id, 'customer_id', v_document.customer_id,
    'status', 'SUBMITTED_BY_CUSTOMER', 'action', 'SUBMIT'
  );
end;
$$;

revoke all on function public.tgd_submit_customer_deposit_request(uuid, text) from public;
grant execute on function public.tgd_submit_customer_deposit_request(uuid, text) to authenticated;

-- Backfill: deposit requests that were already submitted (or further along)
-- but never went through the ACCEPT step, so migration 105 skipped them.
-- Uses each request's submission date (falling back to whatever's
-- available) as the code's date component.
do $$
declare
  v_request  record;
  v_line     record;
  v_code_date date;
begin
  for v_request in
    select
      dr.id,
      coalesce(dr.submitted_at, dr.last_action_at, dr.expected_arrival_date::timestamptz, dr.created_at)::date as code_date
    from public.tgd_customer_deposit_requests dr
    where dr.status in ('SUBMITTED_BY_CUSTOMER', 'ADMIN_REVIEWING')
    order by coalesce(dr.submitted_at, dr.last_action_at, dr.expected_arrival_date::timestamptz, dr.created_at)
  loop
    for v_line in
      select dl.id, dl.temperature_type
      from public.tgd_customer_deposit_request_lines dl
      where dl.deposit_request_id = v_request.id
        and dl.tracking_code is null
      order by dl.line_no
    loop
      update public.tgd_customer_deposit_request_lines
      set tracking_code = public.tgd_generate_deposit_line_tracking_code(v_line.temperature_type, v_request.code_date)
      where id = v_line.id;
    end loop;
  end loop;
end;
$$;

commit;

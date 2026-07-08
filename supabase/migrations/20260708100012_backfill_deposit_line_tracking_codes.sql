-- Migration 105: Backfill tracking codes for already-accepted deposit lines
--
-- Migration 104 only assigns tracking_code going forward (on ACCEPT). This
-- backfills every deposit line belonging to a request that has already
-- passed ACCEPT (i.e. would have gotten a code under the new logic), using
-- each request's actual accept date so the code's date component reflects
-- when the goods were really received, not the day this migration runs.
--
-- Idempotent / safe to re-run: only touches lines where tracking_code is
-- still null, processed oldest-first so sequence numbers come out in a
-- sensible historical order.

begin;

do $$
declare
  v_request  record;
  v_line     record;
  v_code_date date;
begin
  for v_request in
    select
      dr.id,
      coalesce(dr.reviewed_at, dr.last_action_at, dr.expected_arrival_date::timestamptz, dr.created_at)::date as code_date
    from public.tgd_customer_deposit_requests dr
    where dr.status in (
      'ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING',
      'COUNT_VARIANCE_REVIEW', 'ADMIN_RECOUNT_REQUESTED',
      'RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'COMPLETED'
    )
    order by coalesce(dr.reviewed_at, dr.last_action_at, dr.expected_arrival_date::timestamptz, dr.created_at)
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

-- Migration 104: Per-LOT deposit tracking code
--
-- Business request: every deposited LOT gets a human-readable tracking code,
-- generated when the admin ACCEPTs the deposit request (opens the receiving
-- work order):
--
--   {storage-prefix}{DDMMYYYY}{3-digit sequence}   e.g. CH03072026001
--
-- Storage prefix: FROZEN=FR, FREEZE=FZ, CHILLED=CH, FREEZE_FROZEN=FF,
-- AMBIENT=AM (legacy catalog-level type, not used for cold storage but
-- mapped for safety), anything else=XX.
--
-- The 3-digit sequence resets to 001 each day, counted per storage type,
-- warehouse-wide (across all customers) — mirrors the existing
-- request_no ("CDR-YYYYMMDD-NNNN") generation pattern from migration 044.
--
-- The code is shown next to the LOT on both stock balance pages, on the
-- staff receiving work order print (for writing onto physical stickers),
-- and can be used in withdrawal creation as a reference in place of the
-- deposit request number.

begin;

-- 1. Column + uniqueness (multiple NULLs allowed for lines not yet accepted)
alter table public.tgd_customer_deposit_request_lines
  add column if not exists tracking_code text;

create unique index if not exists tgd_customer_deposit_request_lines_tracking_code_key
  on public.tgd_customer_deposit_request_lines (tracking_code)
  where tracking_code is not null;

-- 2. Generator function
create or replace function public.tgd_generate_deposit_line_tracking_code(
  p_temperature_type text,
  p_code_date        date default (timezone('utc', now()))::date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix  text := case upper(coalesce(p_temperature_type, ''))
    when 'FROZEN'        then 'FR'
    when 'FREEZE'        then 'FZ'
    when 'CHILLED'       then 'CH'
    when 'FREEZE_FROZEN' then 'FF'
    when 'AMBIENT'       then 'AM'
    else 'XX'
  end;
  v_day_key text := to_char(p_code_date, 'DDMMYYYY');
  v_seq     integer;
begin
  perform pg_advisory_xact_lock(hashtext('deposit_tracking_code:' || v_prefix || ':' || v_day_key));

  select coalesce(max(
    nullif(regexp_replace(dl.tracking_code, '^' || v_prefix || v_day_key, ''), '')::integer
  ), 0) + 1
  into v_seq
  from public.tgd_customer_deposit_request_lines dl
  where dl.tracking_code like v_prefix || v_day_key || '%';

  return v_prefix || v_day_key || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.tgd_generate_deposit_line_tracking_code(text, date) from public;
grant execute on function public.tgd_generate_deposit_line_tracking_code(text, date) to authenticated;

-- 3. Assign tracking codes on ACCEPT (latest body from migration 101, with
--    tracking-code assignment added after the bridge-to-receiving call).
create or replace function public.tgd_review_customer_deposit_request(
  p_request_id uuid,
  p_decision   text,
  p_comment    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
  v_document     record;
  v_decision     text := upper(nullif(btrim(p_decision), ''));
  v_to_status    text;
  v_receiving_id uuid;
  v_has_variance boolean := false;
  v_line         record;
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
    if not public.tgd_role_function_allowed(
      v_profile.role, 'customer_deposit_confirm_receipt',
      v_profile.role in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin')
    ) then
      raise exception 'Admin, accounting, or warehouse role required';
    end if;
  else
    if not public.tgd_role_function_allowed(
      v_profile.role, 'customer_request_approve',
      v_profile.role in ('admin', 'accounting')
    ) then
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

  -- Status transition logic
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

  -- Update request record
  update public.tgd_customer_deposit_requests
  set status                = v_to_status,
      reviewed_by_user_id   = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.id   else reviewed_by_user_id   end,
      reviewed_by_email     = case when v_decision in ('ACCEPT', 'REJECT') then v_profile.email else reviewed_by_email     end,
      reviewed_at           = case when v_decision in ('ACCEPT', 'REJECT') then now()           else reviewed_at           end,
      web_approved_by_email = case when v_decision = 'CONFIRM_RECEIPT'     then v_profile.email else web_approved_by_email end,
      last_action_by_user_id = v_profile.id,
      last_action_by_email  = v_profile.email,
      last_action_at        = now(),
      review_comment        = coalesce(p_comment, review_comment),
      has_receipt_variance  = case when v_decision = 'CONFIRM_RECEIPT' then v_has_variance else has_receipt_variance end
  where id = v_document.id;

  -- ACCEPT: bridge to warehouse receiving document, then assign a tracking
  -- code to every line that doesn't have one yet (accept date is the code's
  -- date component).
  if v_decision = 'ACCEPT' then
    v_receiving_id := public.tgd_bridge_customer_deposit_to_receiving(v_document.id, v_profile.id);

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
  end if;

  -- CONFIRM_RECEIPT: create stock movements → triggers stock_balances update
  if v_decision = 'CONFIRM_RECEIPT' then
    perform public.tgd_create_stock_movements_from_deposit(v_document.id, v_profile.id);
  end if;

  -- Timeline event
  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment
  ) values (
    'CUSTOMER_DEPOSIT_REQUEST', v_document.id, v_document.customer_id,
    'REVIEW_' || v_decision, v_document.status,
    case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    nullif(btrim(coalesce(p_comment, '')), '')
  );

  return jsonb_build_object(
    'id',                   v_document.id,
    'customer_id',          v_document.customer_id,
    'status',               case when v_decision = 'ACCEPT' then 'WAREHOUSE_RECEIVING' else v_to_status end,
    'action',               'REVIEW_' || v_decision,
    'receiving_document_id', v_receiving_id
  );
end;
$$;

revoke all on function public.tgd_review_customer_deposit_request(uuid, text, text) from public;
grant execute on function public.tgd_review_customer_deposit_request(uuid, text, text) to authenticated;

-- 4. Expose tracking_code on both stock-balance RPCs (latest bodies from
--    migration 100, with tracking_code added to the return set).
drop function if exists public.tgd_get_customer_stock_balance(uuid);
drop function if exists public.tgd_get_all_customer_stock_balances();

create or replace function public.tgd_get_customer_stock_balance(
  p_customer_id uuid
)
returns table (
  deposit_line_id       uuid,
  deposit_request_id    uuid,
  request_no            text,
  lot_no                text,
  tracking_code          text,
  customer_product_code text,
  product_name          text,
  mfg_date              date,
  exp_date              date,
  temperature_type      text,
  received_at           timestamptz,
  received_boxes        numeric,
  received_weight       numeric,
  withdrawn_boxes       numeric,
  withdrawn_weight      numeric,
  balance_boxes         numeric,
  balance_weight        numeric,
  note                  text,
  actual_note            text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  SELECT
    dl.id                                                         AS deposit_line_id,
    dl.deposit_request_id,
    dr.request_no,
    dl.lot_no,
    dl.tracking_code,
    dl.customer_product_code,
    dl.product_name,
    dl.mfg_date,
    dl.exp_date,
    dl.temperature_type,
    COALESCE(dr.last_action_at, dr.expected_arrival_date)         AS received_at,
    COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)             AS received_boxes,
    COALESCE(dl.actual_weight, dl.expected_weight, 0)             AS received_weight,
    COALESCE(w.total_boxes,  0)                                   AS withdrawn_boxes,
    COALESCE(w.total_weight, 0)                                   AS withdrawn_weight,
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0))                              AS balance_boxes,
    GREATEST(0,
      COALESCE(dl.actual_weight, dl.expected_weight, 0)
      - COALESCE(w.total_weight, 0))                              AS balance_weight,
    dl.note                                                       AS note,
    dl.actual_note                                                AS actual_note
  FROM public.tgd_customer_deposit_request_lines dl
  JOIN public.tgd_customer_deposit_requests dr
    ON dr.id  = dl.deposit_request_id
   AND dr.customer_id = p_customer_id
   AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.status      = 'COMPLETED'
     AND wr.customer_id = p_customer_id
    WHERE
      -- A: direct link via source deposit request + lot
      (
        wl.source_customer_deposit_request_id = dl.deposit_request_id
        AND (
          wl.source_lot_no = dl.lot_no
          OR  wl.lot_no    = dl.lot_no
          OR (wl.source_lot_no IS NULL AND wl.lot_no IS NULL AND dl.lot_no IS NULL)
        )
      )
      OR
      -- B: no direct link — match by LOT; product_code is optional (NULL = any)
      (
        wl.source_customer_deposit_request_id IS NULL
        AND COALESCE(wl.lot_no, '') = COALESCE(dl.lot_no, '')
        AND (
          NULLIF(BTRIM(COALESCE(wl.customer_product_code, '')), '') IS NULL
          OR wl.customer_product_code = dl.customer_product_code
        )
      )
  ) w ON true
  WHERE
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0)
    ) > 0
  ORDER BY dr.last_action_at DESC, dl.line_no;
$$;

create or replace function public.tgd_get_all_customer_stock_balances()
returns table (
  customer_id           uuid,
  deposit_line_id       uuid,
  deposit_request_id    uuid,
  request_no            text,
  lot_no                text,
  tracking_code          text,
  customer_product_code text,
  product_name          text,
  mfg_date              date,
  exp_date              date,
  temperature_type      text,
  received_at           timestamptz,
  received_boxes        numeric,
  received_weight       numeric,
  withdrawn_boxes       numeric,
  withdrawn_weight      numeric,
  balance_boxes         numeric,
  balance_weight        numeric,
  note                  text,
  actual_note            text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      record;
begin
  IF v_auth_user_id IS NULL OR NOT public.tgd_current_user_is_active() THEN
    RAISE EXCEPTION 'Active authenticated user required';
  END IF;

  SELECT p.id, p.role INTO v_profile
  FROM public.tgd_user_profiles p
  WHERE p.auth_user_id = v_auth_user_id AND p.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_profile.role NOT IN (
    'admin', 'accounting',
    'warehouse_admin', 'warehouse_manager', 'warehouse_staff'
  ) THEN
    RAISE EXCEPTION 'Insufficient role to view all customer stock balances';
  END IF;

  RETURN QUERY
  SELECT
    dr.customer_id,
    dl.id                                                         AS deposit_line_id,
    dl.deposit_request_id,
    dr.request_no,
    dl.lot_no,
    dl.tracking_code,
    dl.customer_product_code,
    dl.product_name,
    dl.mfg_date,
    dl.exp_date,
    dl.temperature_type,
    COALESCE(dr.last_action_at, dr.expected_arrival_date)         AS received_at,
    COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)             AS received_boxes,
    COALESCE(dl.actual_weight, dl.expected_weight, 0)             AS received_weight,
    COALESCE(w.total_boxes,  0)                                   AS withdrawn_boxes,
    COALESCE(w.total_weight, 0)                                   AS withdrawn_weight,
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0))                              AS balance_boxes,
    GREATEST(0,
      COALESCE(dl.actual_weight, dl.expected_weight, 0)
      - COALESCE(w.total_weight, 0))                              AS balance_weight,
    dl.note                                                       AS note,
    dl.actual_note                                                AS actual_note
  FROM public.tgd_customer_deposit_request_lines dl
  JOIN public.tgd_customer_deposit_requests dr
    ON dr.id = dl.deposit_request_id
   AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.status      = 'COMPLETED'
     AND wr.customer_id = dr.customer_id
    WHERE
      -- A: direct link via source deposit request + lot
      (
        wl.source_customer_deposit_request_id = dl.deposit_request_id
        AND (
          wl.source_lot_no = dl.lot_no
          OR  wl.lot_no    = dl.lot_no
          OR (wl.source_lot_no IS NULL AND wl.lot_no IS NULL AND dl.lot_no IS NULL)
        )
      )
      OR
      -- B: no direct link — match by LOT; product_code is optional (NULL = any)
      (
        wl.source_customer_deposit_request_id IS NULL
        AND COALESCE(wl.lot_no, '') = COALESCE(dl.lot_no, '')
        AND (
          NULLIF(BTRIM(COALESCE(wl.customer_product_code, '')), '') IS NULL
          OR wl.customer_product_code = dl.customer_product_code
        )
      )
  ) w ON true
  WHERE
    GREATEST(0,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)
      - COALESCE(w.total_boxes,  0)
    ) > 0
  ORDER BY dr.customer_id, dr.last_action_at DESC, dl.line_no;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tgd_get_customer_stock_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tgd_get_all_customer_stock_balances() TO authenticated;

commit;

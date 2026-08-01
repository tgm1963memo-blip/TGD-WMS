-- Bug found via user report: "ยอดคงเหลือ ณ วันที่ปัจจุบันเหมือนกัน ยอดไม่เท่ากัน"
-- (as-of-today should match the live total, but showed far less: 54,270
-- vs 85,637 boxes). Root cause: migration 20260801120000's as-of-date
-- filter required a matching REVIEW_CONFIRM_RECEIPT/REVIEW_CONFIRM_DISPATCH
-- row in tgd_customer_document_timeline_events -- but 6 of this
-- customer's confirmed deposit requests (493 lines, ~67,813 boxes --
-- close to the entire size of the gap) have NO such event at all,
-- almost certainly confirmed through an older path/migrated data that
-- predates timeline-event logging. Any as-of-date filter, even
-- "today", silently excluded all of them.
--
-- Fix: when a request's own status already proves it reached
-- RECEIVED_CONFIRMED/COMPLETED but no matching timeline event exists,
-- fall back to the request's own last_action_at (same field already
-- used for received_at's display value, and updated by the exact
-- action that set that status when no event trigger exists to log it
-- separately) instead of silently dropping it from every historical
-- view. This only ever affects requests missing the event -- one with
-- an event keeps using that event's precise timestamp, unaffected.

begin;

create or replace function public.tgd_get_customer_stock_balance(
  p_customer_id uuid,
  p_as_of_date date default null
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
  WITH base_lines AS (
    SELECT
      dl.id                                                 AS deposit_line_id,
      dl.deposit_request_id,
      dr.customer_id,
      dr.request_no,
      dl.lot_no,
      dl.tracking_code,
      dl.customer_product_code,
      COALESCE(cp.product_name, dl.product_name)            AS product_name,
      dl.mfg_date,
      dl.exp_date,
      dl.temperature_type,
      COALESCE(dr.last_action_at, dr.expected_arrival_date) AS received_at,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)      AS received_boxes,
      COALESCE(dl.actual_weight, dl.expected_weight, 0)      AS received_weight,
      dl.note,
      dl.actual_note,
      dl.line_no
    FROM public.tgd_customer_deposit_request_lines dl
    JOIN public.tgd_customer_deposit_requests dr
      ON dr.id = dl.deposit_request_id
     AND dr.customer_id = p_customer_id
     AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
     AND (
       p_as_of_date IS NULL
       OR EXISTS (
         SELECT 1 FROM public.tgd_customer_document_timeline_events ev
         WHERE ev.document_type = 'CUSTOMER_DEPOSIT_REQUEST'
           AND ev.document_id = dr.id
           AND ev.to_status = 'RECEIVED_CONFIRMED'
           AND ev.created_at::date <= p_as_of_date
       )
       OR (
         NOT EXISTS (
           SELECT 1 FROM public.tgd_customer_document_timeline_events ev_any
           WHERE ev_any.document_type = 'CUSTOMER_DEPOSIT_REQUEST'
             AND ev_any.document_id = dr.id
             AND ev_any.to_status = 'RECEIVED_CONFIRMED'
         )
         AND COALESCE(dr.last_action_at, dr.expected_arrival_date)::date <= p_as_of_date
       )
     )
    LEFT JOIN public.tgd_customer_products cp
      ON cp.customer_id = dr.customer_id
     AND cp.customer_product_code = dl.customer_product_code
  ),
  exact_withdrawn AS (
    SELECT
      bl.deposit_line_id,
      COALESCE(SUM(COALESCE(wl.picked_boxes,  wl.requested_boxes)),  0) AS total_boxes,
      COALESCE(SUM(COALESCE(wl.picked_weight, wl.requested_weight)), 0) AS total_weight
    FROM base_lines bl
    JOIN public.tgd_customer_withdrawal_request_lines wl
      ON wl.source_customer_deposit_request_line_id = bl.deposit_line_id
      OR (
        wl.source_customer_deposit_request_line_id IS NULL
        AND wl.tracking_code IS NOT NULL
        AND wl.tracking_code = bl.tracking_code
      )
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.customer_id = p_customer_id
     AND (
       (p_as_of_date IS NULL AND wr.status <> 'CANCELLED')
       OR (p_as_of_date IS NOT NULL AND (
         EXISTS (
           SELECT 1 FROM public.tgd_customer_document_timeline_events ev2
           WHERE ev2.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
             AND ev2.document_id = wr.id
             AND ev2.to_status = 'COMPLETED'
             AND ev2.created_at::date <= p_as_of_date
         )
         OR (
           wr.status = 'COMPLETED'
           AND NOT EXISTS (
             SELECT 1 FROM public.tgd_customer_document_timeline_events ev2_any
             WHERE ev2_any.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
               AND ev2_any.document_id = wr.id
               AND ev2_any.to_status = 'COMPLETED'
           )
           AND wr.last_action_at::date <= p_as_of_date
         )
       ))
     )
    GROUP BY bl.deposit_line_id
  ),
  ambiguous_pool AS (
    SELECT
      COALESCE(NULLIF(BTRIM(wl.source_lot_no), ''), wl.lot_no) AS lot_no,
      wl.customer_product_code,
      COALESCE(SUM(COALESCE(wl.picked_boxes,  wl.requested_boxes)),  0) AS total_boxes,
      COALESCE(SUM(COALESCE(wl.picked_weight, wl.requested_weight)), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.customer_id = p_customer_id
     AND (
       (p_as_of_date IS NULL AND wr.status <> 'CANCELLED')
       OR (p_as_of_date IS NOT NULL AND (
         EXISTS (
           SELECT 1 FROM public.tgd_customer_document_timeline_events ev3
           WHERE ev3.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
             AND ev3.document_id = wr.id
             AND ev3.to_status = 'COMPLETED'
             AND ev3.created_at::date <= p_as_of_date
         )
         OR (
           wr.status = 'COMPLETED'
           AND NOT EXISTS (
             SELECT 1 FROM public.tgd_customer_document_timeline_events ev3_any
             WHERE ev3_any.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
               AND ev3_any.document_id = wr.id
               AND ev3_any.to_status = 'COMPLETED'
           )
           AND wr.last_action_at::date <= p_as_of_date
         )
       ))
     )
    WHERE wl.source_customer_deposit_request_line_id IS NULL
      AND wl.tracking_code IS NULL
    GROUP BY COALESCE(NULLIF(BTRIM(wl.source_lot_no), ''), wl.lot_no), wl.customer_product_code
  ),
  ordered_lines AS (
    SELECT
      bl.*,
      SUM(bl.received_boxes) OVER (
        PARTITION BY bl.lot_no, bl.customer_product_code
        ORDER BY bl.line_no, bl.deposit_line_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cumulative_received_boxes,
      SUM(bl.received_weight) OVER (
        PARTITION BY bl.lot_no, bl.customer_product_code
        ORDER BY bl.line_no, bl.deposit_line_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cumulative_received_weight
    FROM base_lines bl
  ),
  pool_share AS (
    SELECT
      ol.deposit_line_id,
      LEAST(
        ol.received_boxes,
        GREATEST(0, COALESCE(ap.total_boxes, 0) - (ol.cumulative_received_boxes - ol.received_boxes))
      ) AS pool_boxes,
      LEAST(
        ol.received_weight,
        GREATEST(0, COALESCE(ap.total_weight, 0) - (ol.cumulative_received_weight - ol.received_weight))
      ) AS pool_weight
    FROM ordered_lines ol
    LEFT JOIN ambiguous_pool ap
      ON ap.lot_no = ol.lot_no
     AND ap.customer_product_code = ol.customer_product_code
  )
  SELECT
    bl.deposit_line_id,
    bl.deposit_request_id,
    bl.request_no,
    bl.lot_no,
    bl.tracking_code,
    bl.customer_product_code,
    bl.product_name,
    bl.mfg_date,
    bl.exp_date,
    bl.temperature_type,
    bl.received_at,
    bl.received_boxes,
    bl.received_weight,
    (COALESCE(ew.total_boxes, 0) + COALESCE(ps.pool_boxes, 0))   AS withdrawn_boxes,
    (COALESCE(ew.total_weight, 0) + COALESCE(ps.pool_weight, 0)) AS withdrawn_weight,
    GREATEST(0, bl.received_boxes  - (COALESCE(ew.total_boxes, 0)  + COALESCE(ps.pool_boxes, 0)))  AS balance_boxes,
    GREATEST(0, bl.received_weight - (COALESCE(ew.total_weight, 0) + COALESCE(ps.pool_weight, 0))) AS balance_weight,
    bl.note,
    bl.actual_note
  FROM base_lines bl
  LEFT JOIN exact_withdrawn ew ON ew.deposit_line_id = bl.deposit_line_id
  LEFT JOIN pool_share      ps ON ps.deposit_line_id = bl.deposit_line_id
  WHERE GREATEST(0, bl.received_boxes - (COALESCE(ew.total_boxes, 0) + COALESCE(ps.pool_boxes, 0))) > 0
  ORDER BY bl.received_at DESC, bl.line_no;
$$;

create or replace function public.tgd_get_all_customer_stock_balances(
  p_as_of_date date default null
)
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
  WITH base_lines AS (
    SELECT
      dl.id                                                 AS deposit_line_id,
      dl.deposit_request_id,
      dr.customer_id,
      dr.request_no,
      dl.lot_no,
      dl.tracking_code,
      dl.customer_product_code,
      COALESCE(cp.product_name, dl.product_name)            AS product_name,
      dl.mfg_date,
      dl.exp_date,
      dl.temperature_type,
      COALESCE(dr.last_action_at, dr.expected_arrival_date) AS received_at,
      COALESCE(dl.actual_boxes,  dl.expected_boxes,  0)      AS received_boxes,
      COALESCE(dl.actual_weight, dl.expected_weight, 0)      AS received_weight,
      dl.note,
      dl.actual_note,
      dl.line_no
    FROM public.tgd_customer_deposit_request_lines dl
    JOIN public.tgd_customer_deposit_requests dr
      ON dr.id = dl.deposit_request_id
     AND dr.status IN ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
     AND (
       p_as_of_date IS NULL
       OR EXISTS (
         SELECT 1 FROM public.tgd_customer_document_timeline_events ev
         WHERE ev.document_type = 'CUSTOMER_DEPOSIT_REQUEST'
           AND ev.document_id = dr.id
           AND ev.to_status = 'RECEIVED_CONFIRMED'
           AND ev.created_at::date <= p_as_of_date
       )
       OR (
         NOT EXISTS (
           SELECT 1 FROM public.tgd_customer_document_timeline_events ev_any
           WHERE ev_any.document_type = 'CUSTOMER_DEPOSIT_REQUEST'
             AND ev_any.document_id = dr.id
             AND ev_any.to_status = 'RECEIVED_CONFIRMED'
         )
         AND COALESCE(dr.last_action_at, dr.expected_arrival_date)::date <= p_as_of_date
       )
     )
    LEFT JOIN public.tgd_customer_products cp
      ON cp.customer_id = dr.customer_id
     AND cp.customer_product_code = dl.customer_product_code
  ),
  exact_withdrawn AS (
    SELECT
      bl.deposit_line_id,
      COALESCE(SUM(COALESCE(wl.picked_boxes,  wl.requested_boxes)),  0) AS total_boxes,
      COALESCE(SUM(COALESCE(wl.picked_weight, wl.requested_weight)), 0) AS total_weight
    FROM base_lines bl
    JOIN public.tgd_customer_withdrawal_request_lines wl
      ON wl.source_customer_deposit_request_line_id = bl.deposit_line_id
      OR (
        wl.source_customer_deposit_request_line_id IS NULL
        AND wl.tracking_code IS NOT NULL
        AND wl.tracking_code = bl.tracking_code
      )
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.customer_id = bl.customer_id
     AND (
       (p_as_of_date IS NULL AND wr.status <> 'CANCELLED')
       OR (p_as_of_date IS NOT NULL AND (
         EXISTS (
           SELECT 1 FROM public.tgd_customer_document_timeline_events ev2
           WHERE ev2.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
             AND ev2.document_id = wr.id
             AND ev2.to_status = 'COMPLETED'
             AND ev2.created_at::date <= p_as_of_date
         )
         OR (
           wr.status = 'COMPLETED'
           AND NOT EXISTS (
             SELECT 1 FROM public.tgd_customer_document_timeline_events ev2_any
             WHERE ev2_any.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
               AND ev2_any.document_id = wr.id
               AND ev2_any.to_status = 'COMPLETED'
           )
           AND wr.last_action_at::date <= p_as_of_date
         )
       ))
     )
    GROUP BY bl.deposit_line_id
  ),
  ambiguous_pool AS (
    SELECT
      wr.customer_id,
      COALESCE(NULLIF(BTRIM(wl.source_lot_no), ''), wl.lot_no) AS lot_no,
      wl.customer_product_code,
      COALESCE(SUM(COALESCE(wl.picked_boxes,  wl.requested_boxes)),  0) AS total_boxes,
      COALESCE(SUM(COALESCE(wl.picked_weight, wl.requested_weight)), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND (
       (p_as_of_date IS NULL AND wr.status <> 'CANCELLED')
       OR (p_as_of_date IS NOT NULL AND (
         EXISTS (
           SELECT 1 FROM public.tgd_customer_document_timeline_events ev3
           WHERE ev3.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
             AND ev3.document_id = wr.id
             AND ev3.to_status = 'COMPLETED'
             AND ev3.created_at::date <= p_as_of_date
         )
         OR (
           wr.status = 'COMPLETED'
           AND NOT EXISTS (
             SELECT 1 FROM public.tgd_customer_document_timeline_events ev3_any
             WHERE ev3_any.document_type = 'CUSTOMER_WITHDRAWAL_REQUEST'
               AND ev3_any.document_id = wr.id
               AND ev3_any.to_status = 'COMPLETED'
           )
           AND wr.last_action_at::date <= p_as_of_date
         )
       ))
     )
    WHERE wl.source_customer_deposit_request_line_id IS NULL
      AND wl.tracking_code IS NULL
    GROUP BY wr.customer_id, COALESCE(NULLIF(BTRIM(wl.source_lot_no), ''), wl.lot_no), wl.customer_product_code
  ),
  ordered_lines AS (
    SELECT
      bl.*,
      SUM(bl.received_boxes) OVER (
        PARTITION BY bl.customer_id, bl.lot_no, bl.customer_product_code
        ORDER BY bl.line_no, bl.deposit_line_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cumulative_received_boxes,
      SUM(bl.received_weight) OVER (
        PARTITION BY bl.customer_id, bl.lot_no, bl.customer_product_code
        ORDER BY bl.line_no, bl.deposit_line_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cumulative_received_weight
    FROM base_lines bl
  ),
  pool_share AS (
    SELECT
      ol.deposit_line_id,
      LEAST(
        ol.received_boxes,
        GREATEST(0, COALESCE(ap.total_boxes, 0) - (ol.cumulative_received_boxes - ol.received_boxes))
      ) AS pool_boxes,
      LEAST(
        ol.received_weight,
        GREATEST(0, COALESCE(ap.total_weight, 0) - (ol.cumulative_received_weight - ol.received_weight))
      ) AS pool_weight
    FROM ordered_lines ol
    LEFT JOIN ambiguous_pool ap
      ON ap.customer_id = ol.customer_id
     AND ap.lot_no = ol.lot_no
     AND ap.customer_product_code = ol.customer_product_code
  )
  SELECT
    bl.customer_id,
    bl.deposit_line_id,
    bl.deposit_request_id,
    bl.request_no,
    bl.lot_no,
    bl.tracking_code,
    bl.customer_product_code,
    bl.product_name,
    bl.mfg_date,
    bl.exp_date,
    bl.temperature_type,
    bl.received_at,
    bl.received_boxes,
    bl.received_weight,
    (COALESCE(ew.total_boxes, 0) + COALESCE(ps.pool_boxes, 0))   AS withdrawn_boxes,
    (COALESCE(ew.total_weight, 0) + COALESCE(ps.pool_weight, 0)) AS withdrawn_weight,
    GREATEST(0, bl.received_boxes  - (COALESCE(ew.total_boxes, 0)  + COALESCE(ps.pool_boxes, 0)))  AS balance_boxes,
    GREATEST(0, bl.received_weight - (COALESCE(ew.total_weight, 0) + COALESCE(ps.pool_weight, 0))) AS balance_weight,
    bl.note,
    bl.actual_note
  FROM base_lines bl
  LEFT JOIN exact_withdrawn ew ON ew.deposit_line_id = bl.deposit_line_id
  LEFT JOIN pool_share      ps ON ps.deposit_line_id = bl.deposit_line_id
  WHERE GREATEST(0, bl.received_boxes - (COALESCE(ew.total_boxes, 0) + COALESCE(ps.pool_boxes, 0))) > 0
  ORDER BY bl.customer_id, bl.received_at DESC, bl.line_no;
END;
$$;

commit;

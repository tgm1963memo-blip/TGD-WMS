-- Migration 112: Fix stock balance double/triple-counting when a LOT spans
-- multiple deposit lines (tracking codes)
--
-- Bug report: LOT 163 / product 10154 has 3 sibling deposit lines (tracking
-- codes FR260630017 = 300 boxes, FR260630019 = 700 boxes, FR260630020 = 100
-- boxes received together). Two COMPLETED withdrawals against that LOT
-- (100 boxes, 200 boxes = 300 total) left the admin stock-balance screen
-- showing only 400 boxes remaining for FR260630019, while the movement
-- ledger (and simple arithmetic: 1100 received - 300 withdrawn = 800) said
-- it should be 700-800.
--
-- Root cause: tgd_get_all_customer_stock_balances() / tgd_get_customer_stock_
-- balance() matched "no direct source line" withdrawals to a deposit line by
-- LOT number alone (clause B) via a LATERAL join evaluated once PER sibling
-- deposit line. A withdrawal with no source_customer_deposit_request_line_id
-- and no tracking_code matches every sibling line sharing that LOT, so its
-- picked quantity was independently re-subtracted from EVERY sibling instead
-- of once total — the same withdrawal counted 3x for a LOT with 3 siblings.
--
-- Fix:
--   1. Add two new *unambiguous* 1:1 match paths that were available but
--      never used: wl.source_customer_deposit_request_line_id = dl.id (the
--      column has existed since migration 040, extended to be written by
--      migration 106, but no balance query ever read it), and
--      wl.tracking_code = dl.tracking_code (tracking codes are unique per
--      deposit line, so this can never fan out either).
--   2. For the remaining genuinely-ambiguous withdrawals (no source line, no
--      tracking code — only a bare LOT/product reference), pool the total
--      withdrawn once per (customer, lot, product) and allocate it across
--      sibling lines with a FIFO running-sum window function, so the SUM
--      subtracted across all siblings always equals the true pool total
--      instead of being multiplied by the sibling count.
--
-- For the (overwhelmingly common) case of a LOT with only one deposit line,
-- this produces identical results to before — only multi-line LOTs change.

begin;

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
  WITH base_lines AS (
    SELECT
      dl.id                                                 AS deposit_line_id,
      dl.deposit_request_id,
      dr.customer_id,
      dr.request_no,
      dl.lot_no,
      dl.tracking_code,
      dl.customer_product_code,
      dl.product_name,
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
  ),
  exact_withdrawn AS (
    SELECT
      bl.deposit_line_id,
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
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
     AND wr.status      = 'COMPLETED'
     AND wr.customer_id = p_customer_id
    GROUP BY bl.deposit_line_id
  ),
  ambiguous_pool AS (
    SELECT
      COALESCE(NULLIF(BTRIM(wl.source_lot_no), ''), wl.lot_no) AS lot_no,
      wl.customer_product_code,
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.status      = 'COMPLETED'
     AND wr.customer_id = p_customer_id
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
  WITH base_lines AS (
    SELECT
      dl.id                                                 AS deposit_line_id,
      dl.deposit_request_id,
      dr.customer_id,
      dr.request_no,
      dl.lot_no,
      dl.tracking_code,
      dl.customer_product_code,
      dl.product_name,
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
  ),
  exact_withdrawn AS (
    SELECT
      bl.deposit_line_id,
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
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
     AND wr.status      = 'COMPLETED'
     AND wr.customer_id = bl.customer_id
    GROUP BY bl.deposit_line_id
  ),
  ambiguous_pool AS (
    SELECT
      wr.customer_id,
      COALESCE(NULLIF(BTRIM(wl.source_lot_no), ''), wl.lot_no) AS lot_no,
      wl.customer_product_code,
      COALESCE(SUM(wl.picked_boxes),  0) AS total_boxes,
      COALESCE(SUM(wl.picked_weight), 0) AS total_weight
    FROM public.tgd_customer_withdrawal_request_lines wl
    JOIN public.tgd_customer_withdrawal_requests wr
      ON wr.id = wl.withdrawal_request_id
     AND wr.status = 'COMPLETED'
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

GRANT EXECUTE ON FUNCTION public.tgd_get_customer_stock_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tgd_get_all_customer_stock_balances() TO authenticated;

commit;

-- Migration 110: Opening-balance import never gets a tracking code
--
-- Root cause: tgd_import_opening_balance() (096-099) writes deposit lines
-- directly into RECEIVED_CONFIRMED status, bypassing tgd_review_customer_deposit_request
-- (ACCEPT) and tgd_submit_customer_deposit_request (SUBMIT) entirely — the two
-- places that assign tracking_code (migrations 104/107). It also never sets
-- temperature_type on the line or the catalog row, so even the one-time
-- backfill (105) could only fall back to the generic 'XX' prefix for these
-- rows, and imports done after that backfill got no code at all.
--
-- Fix:
--   1. tgd_import_opening_balance now resolves temperature_type from the
--      customer's existing catalog entry when available, defaulting to
--      FROZEN when the catalog has none (this warehouse is a cold-storage
--      operator; FROZEN is the sensible default for stock with no
--      classification on file, per business decision), and generates the
--      tracking_code immediately at insert time — matching what every other
--      deposit path already gets.
--   2. Backfill: the 27 lines from the most recent opening-balance import
--      (OB-20260704-015615) that are still fully missing a tracking_code —
--      set temperature_type = FROZEN (same business decision) on both the
--      catalog and the line, then generate codes using each line's created_at
--      as the code date.
--
-- NOT in scope: the ~165 older opening-balance lines that already got an
-- 'XX'-prefixed code from the one-time backfill (105) — those already show
-- *a* code (not blank), may already be printed on physical stickers, and
-- changing them retroactively needs a separate confirmed decision.

begin;

create or replace function public.tgd_import_opening_balance(
  p_customer_id uuid,
  p_rows        jsonb,
  p_actor_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_row            jsonb;
  v_idx            int := 0;
  v_product_code   text;
  v_product_name   text;
  v_lot_no         text;
  v_mfg_date       date;
  v_expiry_date    date;
  v_location_code  text;
  v_qty            numeric;
  v_weight         numeric;
  v_note           text;

  v_product_id     uuid;
  v_location_id    uuid;
  v_temperature_type text;
  v_tracking_code    text;

  v_request_id     uuid;
  v_request_no     text;
  v_processed      int := 0;
  v_errors         jsonb := '[]'::jsonb;
BEGIN
  -- Generate unique request_no: OB-YYYYMMDD-HH24MISS
  v_request_no := 'OB-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  -- Ensure uniqueness (in case of concurrent imports in the same second)
  WHILE EXISTS (SELECT 1 FROM public.tgd_customer_deposit_requests WHERE request_no = v_request_no) LOOP
    v_request_no := 'OB-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || (floor(random()*900)+100)::text;
  END LOOP;

  -- Create the deposit request (already confirmed — no workflow needed)
  -- Use only required columns to avoid FK issues on optional audit columns
  INSERT INTO public.tgd_customer_deposit_requests (
    request_no,
    customer_id,
    status,
    expected_arrival_date,
    last_action_at,
    created_at,
    updated_at
  ) VALUES (
    v_request_no,
    p_customer_id,
    'RECEIVED_CONFIRMED',
    now()::date,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_request_id;

  -- Process each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;

    v_product_code  := trim(v_row->>'customer_product_code');
    v_product_name  := trim(coalesce(nullif(v_row->>'product_name',''), v_product_code));
    v_lot_no        := nullif(trim(v_row->>'lot_no'), '');
    v_location_code := nullif(trim(v_row->>'location_code'), '');
    v_note          := nullif(trim(v_row->>'note'), '');
    v_qty           := (v_row->>'qty_boxes')::numeric;
    v_weight        := coalesce(nullif(trim(v_row->>'weight_kg'), ''), '0')::numeric;

    BEGIN v_mfg_date    := nullif(trim(v_row->>'mfg_date'), '')::date;
    EXCEPTION WHEN OTHERS THEN v_mfg_date := null; END;
    BEGIN v_expiry_date := nullif(trim(v_row->>'expiry_date'), '')::date;
    EXCEPTION WHEN OTHERS THEN v_expiry_date := null; END;

    -- Validate
    IF v_product_code IS NULL OR v_product_code = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'customer_product_code ไม่ระบุ');
      CONTINUE;
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'qty_boxes ต้องมากกว่า 0');
      CONTINUE;
    END IF;

    -- Resolve location (optional)
    v_location_id := null;
    IF v_location_code IS NOT NULL THEN
      SELECT id INTO v_location_id
      FROM public.tgd_locations WHERE location_code = v_location_code LIMIT 1;
      IF v_location_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'ไม่พบ location_code: ' || v_location_code);
        CONTINUE;
      END IF;
    END IF;

    -- Find or create internal product (for tgd_create_stock_movements_from_deposit)
    SELECT id INTO v_product_id FROM public.tgd_products WHERE sku = v_product_code LIMIT 1;
    IF v_product_id IS NULL THEN
      INSERT INTO public.tgd_products (sku, name, created_at, updated_at)
      VALUES (v_product_code, v_product_name, now(), now())
      RETURNING id INTO v_product_id;
    END IF;

    -- Resolve storage/temperature type from the customer's existing catalog
    -- entry (if any); default to FROZEN when unclassified (cold-storage
    -- warehouse — business decision) so imported stock still gets a proper
    -- FR/FZ/CH/FF tracking code instead of falling back to 'XX'.
    SELECT temperature_type INTO v_temperature_type
    FROM public.tgd_customer_products
    WHERE customer_id = p_customer_id AND customer_product_code = v_product_code
    LIMIT 1;
    v_temperature_type := coalesce(v_temperature_type, 'FROZEN');

    -- Ensure customer_products mapping (so tgd_create_stock_movements_from_deposit can find it)
    INSERT INTO public.tgd_customer_products (
      customer_id, customer_product_code, product_name, internal_product_id, temperature_type, created_at, updated_at
    ) VALUES (
      p_customer_id, v_product_code, v_product_name, v_product_id, v_temperature_type, now(), now()
    )
    ON CONFLICT (customer_id, customer_product_code)
    DO UPDATE SET
      internal_product_id = v_product_id,
      product_name = v_product_name,
      temperature_type = coalesce(public.tgd_customer_products.temperature_type, v_temperature_type),
      updated_at = now();

    v_tracking_code := public.tgd_generate_deposit_line_tracking_code(v_temperature_type, now()::date);

    -- Create deposit line with actual receipt recorded
    INSERT INTO public.tgd_customer_deposit_request_lines (
      deposit_request_id,
      line_no,
      customer_product_code,
      product_name,
      lot_no,
      mfg_date,
      exp_date,
      expected_boxes,
      expected_weight,
      actual_boxes,
      actual_weight,
      actual_note,
      location_id,
      uom,
      temperature_type,
      tracking_code,
      created_at
    ) VALUES (
      v_request_id,
      v_idx,
      v_product_code,
      v_product_name,
      v_lot_no,
      v_mfg_date,
      v_expiry_date,
      v_qty,
      v_weight,
      v_qty,      -- actual = same as expected for opening balance
      v_weight,
      v_note,
      v_location_id,
      'กล่อง',
      v_temperature_type,
      v_tracking_code,
      now()
    );

    v_processed := v_processed + 1;
  END LOOP;

  -- Create stock movements + balances via the existing confirmed function
  -- (only lines with location_id AND a resolvable product will create stock_balances)
  IF v_processed > 0 THEN
    PERFORM public.tgd_create_stock_movements_from_deposit(v_request_id, p_actor_id);
  END IF;

  RETURN jsonb_build_object(
    'processed',   v_processed,
    'request_id',  v_request_id,
    'request_no',  v_request_no,
    'errors',      v_errors
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.tgd_import_opening_balance(uuid, jsonb, uuid) TO authenticated;

-- ─── Backfill: 27 lines from OB-20260704-015615 still missing a code ───────

update public.tgd_customer_products cp
set temperature_type = 'FROZEN'
from public.tgd_customer_deposit_request_lines dl
join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
where cp.customer_id = dr.customer_id
  and cp.customer_product_code = dl.customer_product_code
  and cp.temperature_type is null
  and dl.tracking_code is null
  and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED');

update public.tgd_customer_deposit_request_lines
set temperature_type = 'FROZEN'
where temperature_type is null
  and tracking_code is null
  and deposit_request_id in (
    select dr.id from public.tgd_customer_deposit_requests dr
    where dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
  );

do $$
declare
  v_line record;
begin
  for v_line in
    select dl.id, dl.temperature_type, dl.created_at::date as code_date
    from public.tgd_customer_deposit_request_lines dl
    join public.tgd_customer_deposit_requests dr on dr.id = dl.deposit_request_id
    where dl.tracking_code is null
      and dr.status in ('RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED')
    order by dl.created_at, dl.line_no
  loop
    update public.tgd_customer_deposit_request_lines
    set tracking_code = public.tgd_generate_deposit_line_tracking_code(v_line.temperature_type, v_line.code_date)
    where id = v_line.id;
  end loop;
end;
$$;

commit;

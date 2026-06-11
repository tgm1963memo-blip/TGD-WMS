-- 034_tgd_wms_unified_movement_read_view.sql

-- Gate 2.5: Unified movement READ view for reporting/billing alignment.

-- Staging-safe: uses tgd_stock_movements always; unions tgd_inventory_movements only when present.

-- Production remains HOLD. FINAL GO is NOT AUTHORIZED.

-- Does NOT drop or alter tgd_stock_movements / tgd_inventory_movements.



do $$

declare

  v_sql text;

  v_stock_part text := $stock$

select

  sm.id,

  'stock_ledger'::text as ledger_source,

  sm.movement_type as movement_type_raw,

  case sm.movement_type

    when 'RECEIVE_CONFIRM' then 'RECEIVE'

    when 'RECEIPT' then 'RECEIVE'

    when 'RECEIVING' then 'RECEIVE'

    when 'PUTAWAY_CONFIRM' then 'PUTAWAY'

    when 'TRANSFER_CONFIRM' then 'TRANSFER'

    when 'ADJUSTMENT_CONFIRM' then 'ADJUST_IN'

    when 'ADJUST_IN_CONFIRM' then 'ADJUST_IN'

    when 'ADJUST_OUT_CONFIRM' then 'ADJUST_OUT'

    when 'PICK_CONFIRM' then 'PICK_CONFIRM'

    when 'DISPATCH_CONFIRM' then 'PICK_CONFIRM'

    when 'WITHDRAWAL' then 'PICK_CONFIRM'

    when 'DISPATCH' then 'PICK_CONFIRM'

    else sm.movement_type

  end as movement_type_canonical,

  sm.movement_type as movement_type,

  null::text as movement_subtype,

  null::text as movement_no,

  sm.customer_id,

  sm.product_id,

  sm.lot_id,

  null::uuid as from_warehouse_id,

  sm.from_location_id,

  null::uuid as from_pallet_id,

  null::uuid as to_warehouse_id,

  sm.to_location_id,

  null::uuid as to_pallet_id,

  sm.quantity as qty,

  sm.quantity,

  null::text as uom,

  sm.weight,

  coalesce(sm.weight, 0::numeric) as gross_weight,

  coalesce(sm.weight, 0::numeric) as net_weight,

  coalesce(sm.weight, 0::numeric) as chargeable_weight,

  sm.movement_date,

  sm.source_module,

  sm.source_document_id,

  sm.source_line_id,

  sm.related_document_id,

  coalesce(sm.source_module, 'STOCK_MOVEMENT') as reference_type,

  null::text as reference_no,

  sm.source_document_id as reference_id,

  null::text as reason_code,

  null::text as remark,

  sm.created_at,

  false as is_reversed,

  null::uuid as reversed_by_movement_id,

  false as is_draft,

  case

    when sm.source_document_id is not null

      and sm.movement_type in ('RECEIVE_CONFIRM', 'RECEIPT', 'RECEIVING')

      then true

    when sm.source_document_id is not null

      and sm.movement_type in ('DISPATCH_CONFIRM', 'DISPATCH', 'WITHDRAWAL')

      then true

    else false

  end as is_billable,

  case

    when sm.source_document_id is null then 'MISSING_TRACEABILITY'

    when sm.movement_type in ('PUTAWAY_CONFIRM', 'PUTAWAY') then 'NON_BILLABLE_TYPE'

    when sm.movement_type in ('PICK_CONFIRM') then 'PICK_NOT_FINAL_DISPATCH'

    when sm.movement_type in ('TRANSFER_CONFIRM', 'TRANSFER') then 'TRANSFER_NOT_CONFIGURED'

    when sm.movement_type in ('ADJUSTMENT_CONFIRM', 'ADJUST_IN_CONFIRM', 'ADJUST_OUT_CONFIRM') then 'ADJUSTMENT_DEFAULT_EXCLUDED'

    when sm.movement_type in ('RECEIVE_CONFIRM', 'RECEIPT', 'RECEIVING', 'DISPATCH_CONFIRM', 'DISPATCH', 'WITHDRAWAL') then null

    else 'NON_BILLABLE_TYPE'

  end as billing_exclusion_reason,

  case

    when sm.source_document_id is not null

      and sm.movement_type in ('RECEIVE_CONFIRM', 'RECEIPT', 'RECEIVING')

      then 'INBOUND_HANDLING'

    when sm.source_document_id is not null

      and sm.movement_type in ('DISPATCH_CONFIRM', 'DISPATCH', 'WITHDRAWAL')

      then 'OUTBOUND_HANDLING'

    else 'NON_BILLABLE'

  end as billing_service_type,

  case

    when coalesce(sm.weight, 0) > 0 then 'READY_FOR_PREVIEW'

    else 'NEEDS_WEIGHT_REVIEW'

  end as billing_status,

  sm.source_document_id is not null

    and sm.movement_type in ('RECEIVE_CONFIRM', 'DISPATCH_CONFIRM', 'DISPATCH', 'WITHDRAWAL')

  as is_billing_source

from public.tgd_stock_movements sm

$stock$;

  v_inventory_part text := $inv$

union all

select

  im.id,

  'inventory_ledger'::text as ledger_source,

  im.movement_type as movement_type_raw,

  im.movement_type as movement_type_canonical,

  im.movement_type,

  im.movement_subtype,

  im.movement_no,

  im.customer_id,

  im.product_id,

  im.lot_id,

  im.from_warehouse_id,

  im.from_location_id,

  im.from_pallet_id,

  im.to_warehouse_id,

  im.to_location_id,

  im.to_pallet_id,

  im.qty,

  im.qty as quantity,

  im.uom,

  null::numeric as weight,

  0::numeric as gross_weight,

  0::numeric as net_weight,

  0::numeric as chargeable_weight,

  im.created_at as movement_date,

  im.reference_type as source_module,

  im.reference_id as source_document_id,

  null::uuid as source_line_id,

  im.reference_id as related_document_id,

  im.reference_type,

  im.reference_no,

  im.reference_id,

  im.reason_code,

  im.remark,

  im.created_at,

  im.is_reversed,

  im.reversed_by_movement_id,

  case

    when upper(coalesce(im.movement_type, '')) like '%DRAFT%' then true

    when upper(coalesce(im.movement_subtype, '')) like '%DRAFT%' then true

    when upper(coalesce(im.reference_type, '')) like '%DRAFT%' then true

    else false

  end as is_draft,

  case

    when im.is_reversed then false

    when upper(coalesce(im.movement_type, '')) like '%DRAFT%' then false

    when im.movement_type = 'RECEIVE' and im.reference_id is not null then true

    else false

  end as is_billable,

  case

    when im.is_reversed then 'REVERSED_MOVEMENT'

    when upper(coalesce(im.movement_type, '')) like '%DRAFT%' then 'DRAFT_MOVEMENT'

    when im.reference_id is null then 'MISSING_TRACEABILITY'

    when im.movement_type in ('PUTAWAY', 'PICK_ALLOCATE', 'OPENING_BALANCE', 'REVERSE') then 'NON_BILLABLE_TYPE'

    when im.movement_type in ('ADJUST_IN', 'ADJUST_OUT') then 'ADJUSTMENT_DEFAULT_EXCLUDED'

    when im.movement_type = 'TRANSFER' then 'TRANSFER_NOT_CONFIGURED'

    when im.movement_type = 'PICK_CONFIRM' then 'PICK_NOT_FINAL_DISPATCH'

    when im.movement_type = 'RECEIVE' and im.reference_id is not null then null

    else 'NON_BILLABLE_TYPE'

  end as billing_exclusion_reason,

  case

    when im.is_reversed then 'NON_BILLABLE'

    when im.movement_type = 'RECEIVE' and im.reference_id is not null then 'INBOUND_HANDLING'

    else 'NON_BILLABLE'

  end as billing_service_type,

  case

    when im.is_reversed then 'EXCLUDED'

    when im.movement_type = 'RECEIVE' and im.reference_id is not null then 'NEEDS_WEIGHT_REVIEW'

    else 'EXCLUDED'

  end as billing_status,

  case

    when im.is_reversed then false

    when upper(coalesce(im.movement_type, '')) like '%DRAFT%' then false

    when im.movement_type = 'RECEIVE' and im.reference_id is not null then true

    else false

  end as is_billing_source

from public.tgd_inventory_movements im

$inv$;

begin

  v_sql := 'create or replace view public.tgd_unified_movements_v as ' || v_stock_part;



  if to_regclass('public.tgd_inventory_movements') is not null then

    v_sql := v_sql || v_inventory_part;

  end if;



  execute v_sql;

end $$;



comment on view public.tgd_unified_movements_v is

  'Gate 2.5 unified movement read view with conservative billable flags. Production HOLD.';


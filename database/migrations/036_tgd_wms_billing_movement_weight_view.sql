-- 036_tgd_wms_billing_movement_weight_view.sql

-- Gate 2.5: Billing movement weight read view (foundation only).

-- Staging-safe: uses tgd_customers.name, tgd_products.sku/name/unit, tgd_lots.lot_number, tgd_pallets.identifier.

-- No invoice draft, no BILLED workflow, no Bplus export tables.

-- Production remains HOLD. FINAL GO is NOT AUTHORIZED.



create or replace view public.tgd_billing_movement_weight_v as

select

  um.id as movement_id,

  um.movement_type_raw as movement_type,

  um.movement_type_canonical,

  um.movement_date,

  um.customer_id,

  null::text as customer_code,

  c.name as customer_name,

  um.product_id,

  p.sku as product_code,

  coalesce(p.name, p.description) as product_name,

  um.lot_id,

  l.lot_number as lot_no,

  coalesce(um.to_pallet_id, um.from_pallet_id) as pallet_id,

  pal.identifier as pallet_no,

  coalesce(um.to_warehouse_id, um.from_warehouse_id) as warehouse_id,

  um.from_location_id,

  um.to_location_id,

  um.qty,

  coalesce(um.uom, p.unit) as uom,

  um.net_weight,

  um.gross_weight,

  um.chargeable_weight,

  null::numeric as weight_per_unit,

  null::numeric as pallet_weight,

  um.reference_no as source_document_no,

  coalesce(um.source_module, um.reference_type) as source_document_type,

  um.source_document_id,

  um.is_draft,

  um.is_billable,

  um.billing_exclusion_reason,

  um.billing_service_type,

  um.billing_status,

  um.ledger_source

from public.tgd_unified_movements_v um

left join public.tgd_customers c on c.id = um.customer_id

left join public.tgd_products p on p.id = um.product_id

left join public.tgd_lots l on l.id = um.lot_id

left join public.tgd_pallets pal on pal.id = coalesce(um.to_pallet_id, um.from_pallet_id);



comment on view public.tgd_billing_movement_weight_v is

  'Gate 2.5 billing movement weight foundation view. Preview only. Production HOLD.';


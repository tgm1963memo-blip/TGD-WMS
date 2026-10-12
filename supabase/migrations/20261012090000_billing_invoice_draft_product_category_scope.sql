begin;

-- Lets a period/auto-lot invoice draft be scoped to one product group — the
-- customer catalog's free-text tgd_customer_products.product_category, e.g.
-- "Raw material" vs "Finished Goods" — on top of the existing storage-type
-- scope (temperature_type). Null (the default, and every existing draft)
-- means "all groups", matching today's behavior exactly. The value
-- '__UNCATEGORIZED__' means products with no group set (see
-- UNCATEGORIZED_PRODUCT_CATEGORY in src/utils/billingRateCalc.js).
alter table public.tgd_billing_invoice_drafts
  add column if not exists product_category text;

notify pgrst, 'reload schema';

commit;

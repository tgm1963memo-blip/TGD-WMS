begin;

-- Lets a storage/service invoice draft be scoped to one storage method
-- (FROZEN/CHILLED/FREEZE/FREEZE_FROZEN/AMBIENT) instead of always covering
-- every lot a customer has for the period — e.g. billing FROZEN storage
-- separately from CHILLED for the same billing period. Null (the default,
-- and every existing draft) means "all storage types", matching today's
-- behavior exactly.
alter table public.tgd_billing_invoice_drafts
  add column if not exists temperature_type text;

commit;

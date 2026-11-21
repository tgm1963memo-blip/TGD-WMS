-- Adds "หนังไก่แช่แข็ง" (frozen chicken skin) to the fixed ร.3 carcass type
-- list, so catalog products and ร.3 permit rows can use it. Additive only:
-- existing types, products and permits are untouched, and re-running is a no-op.

insert into public.tgd_r3_carcass_types (code, animal_type, label_th, sort_order) values
  ('CHICKEN_SKIN_FROZEN', 'ไก่', 'หนังไก่แช่แข็ง', 80)
on conflict (code) do nothing;

-- Migration 097: Add mfg_date, expiry_date, note to tgd_lots (if missing)
ALTER TABLE public.tgd_lots
  ADD COLUMN IF NOT EXISTS mfg_date    date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS note        text;

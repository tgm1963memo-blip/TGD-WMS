-- Sticker print history (ประวัติการพิมพ์สติ๊กเกอร์).
--
-- One row per sticker sheet sent to the printer (thermal or A5), written by
-- the browser right after it opens the print dialog. It records that a print
-- was requested, not that the printer finished. Used to show "printed N
-- times, last at ..." next to each deposit line.
--
-- Staff insert their own rows (who/when come from the session, not the
-- client); staff read all rows. No update or delete.
--
-- Idempotent: safe to run more than once.

begin;

create table if not exists public.tgd_sticker_print_logs (
  id uuid primary key default gen_random_uuid(),
  printed_at timestamptz not null default now(),
  printed_by_auth_id uuid not null default auth.uid(),
  printed_by_email text default (auth.jwt() ->> 'email'),
  sticker_format text not null,
  tracking_code text,
  pallet_index integer,
  pallet_total integer,
  location_code text,
  boxes numeric,
  source_path text,
  constraint tgd_sticker_print_logs_format_check check (sticker_format in ('THERMAL', 'A5'))
);

create index if not exists tgd_sticker_print_logs_tracking_idx
  on public.tgd_sticker_print_logs (tracking_code, printed_at desc);
create index if not exists tgd_sticker_print_logs_printed_at_idx
  on public.tgd_sticker_print_logs (printed_at desc);

alter table public.tgd_sticker_print_logs enable row level security;

drop policy if exists tgd_sticker_print_logs_staff_read on public.tgd_sticker_print_logs;
create policy tgd_sticker_print_logs_staff_read
on public.tgd_sticker_print_logs
for select
to authenticated
using (public.tgd_current_user_role() = any (array['admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff']));

drop policy if exists tgd_sticker_print_logs_staff_insert on public.tgd_sticker_print_logs;
create policy tgd_sticker_print_logs_staff_insert
on public.tgd_sticker_print_logs
for insert
to authenticated
with check (
  printed_by_auth_id = auth.uid()
  and public.tgd_current_user_role() = any (array['admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff'])
);

grant select, insert on public.tgd_sticker_print_logs to authenticated;

notify pgrst, 'reload schema';
commit;

-- Stop customer-request notification emails from being sent to role=admin.
-- Existing notification RPCs may still enqueue admin rows from older function
-- definitions, so enforce the rule at the queue boundary and clean pending
-- rows that were already created.

begin;

update public.tgd_customer_request_email_queue
set
  status = 'SKIPPED',
  error_log = coalesce(error_log, 'Skipped: role admin no longer receives request emails.'),
  sent_at = coalesce(sent_at, now())
where status = 'PENDING'
  and lower(btrim(coalesce(recipient_role, ''))) = 'admin';

create or replace function public.tgd_skip_admin_request_email_queue()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if lower(btrim(coalesce(new.recipient_role, ''))) = 'admin' then
    new.status := 'SKIPPED';
    new.error_log := coalesce(new.error_log, 'Skipped: role admin no longer receives request emails.');
    new.sent_at := coalesce(new.sent_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists tgd_skip_admin_request_email_queue_trg
  on public.tgd_customer_request_email_queue;

create trigger tgd_skip_admin_request_email_queue_trg
before insert or update of recipient_role, status
on public.tgd_customer_request_email_queue
for each row
when (
  lower(btrim(coalesce(new.recipient_role, ''))) = 'admin'
  and new.status = 'PENDING'
)
execute function public.tgd_skip_admin_request_email_queue();

notify pgrst, 'reload schema';

commit;

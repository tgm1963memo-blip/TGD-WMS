-- Facility Usage requests (ใบขอใช้สถานที่) used a fixed, billing-unrelated
-- usage_type enum (STORAGE_AREA/LOADING_DOCK/INSPECTION_ROOM/OTHER) with no
-- link to what the customer is actually charged. Replaces it with a
-- reference to one of the customer's own configured service rates, so a
-- submitted request is tied to a known price — same snapshot-at-submission
-- pattern already used elsewhere (e.g. weight_per_box on deposit lines) so a
-- later rate edit doesn't retroactively change what an already-submitted
-- request shows.
--
-- No backfill needed: confirmed zero existing rows in
-- tgd_customer_facility_usage_requests at the time of this migration.

begin;

alter table public.tgd_customer_facility_usage_requests
  drop constraint if exists tgd_customer_facility_usage_requests_usage_type_check;

alter table public.tgd_customer_facility_usage_requests
  add column if not exists service_rate_id uuid references public.tgd_customer_product_service_rates(id) on delete set null,
  add column if not exists service_rate_amount numeric,
  add column if not exists service_rate_unit_basis text;

drop function if exists public.tgd_create_customer_facility_usage_request(date, text, numeric, text, text, text, uuid);

create or replace function public.tgd_create_customer_facility_usage_request(
  p_requested_usage_date date default null,
  p_usage_type text default null,
  p_duration_hours numeric default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_note text default null,
  p_customer_id uuid default null,
  p_service_rate_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_customer_id uuid;
  v_request_id uuid;
  v_request_no text;
  v_rate_customer_id uuid;
  v_rate_service_type text;
  v_rate_amount numeric;
  v_rate_unit_basis text;
  v_usage_type text := upper(coalesce(nullif(btrim(p_usage_type), ''), 'OTHER'));
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;

  if not found then raise exception 'Active profile required'; end if;
  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  v_customer_id := coalesce(p_customer_id, v_profile.customer_id);
  if v_customer_id is null then raise exception 'customer_id is required'; end if;
  perform public.tgd_assert_customer_request_document_scope(v_profile.role, v_profile.customer_id, v_customer_id);

  if p_service_rate_id is not null then
    select r.service_type, r.rate, r.unit_basis,
           coalesce(r.customer_id, cp.customer_id)
    into v_rate_service_type, v_rate_amount, v_rate_unit_basis, v_rate_customer_id
    from public.tgd_customer_product_service_rates r
    left join public.tgd_customer_products cp on cp.id = r.customer_product_id
    where r.id = p_service_rate_id;

    if not found then
      raise exception 'Service rate not found';
    end if;

    if v_rate_customer_id is distinct from v_customer_id then
      raise exception 'Service rate belongs to a different customer';
    end if;

    v_usage_type := v_rate_service_type;
  end if;

  v_request_no := public.tgd_next_facility_usage_request_no();

  insert into public.tgd_customer_facility_usage_requests (
    request_no, customer_id, status, requested_usage_date, usage_type,
    duration_hours, contact_name, contact_phone, note, created_by_user_id, created_by_email,
    service_rate_id, service_rate_amount, service_rate_unit_basis
  ) values (
    v_request_no, v_customer_id, 'DRAFT', p_requested_usage_date,
    v_usage_type,
    p_duration_hours, nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_phone), ''),
    nullif(btrim(p_note), ''), v_profile.id, v_profile.email,
    p_service_rate_id, v_rate_amount, v_rate_unit_basis
  ) returning id into v_request_id;

  return jsonb_build_object('id', v_request_id, 'request_no', v_request_no, 'status', 'DRAFT');
end;
$$;

grant execute on function public.tgd_create_customer_facility_usage_request(date, text, numeric, text, text, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

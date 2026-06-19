create or replace function public.admin_get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
as $$
  select id from auth.users where email = p_email limit 1;
$$;

create or replace function public.current_shop_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(au.company_owner_id, au.id, auth.uid())
  from public.app_users au
  where au.id = auth.uid()
$$;

drop policy if exists "app_users_select_own" on public.app_users;
create policy "app_users_select_own"
on public.app_users for select
using (public.current_shop_owner_id() = coalesce(company_owner_id, id));

drop policy if exists "app_users_update_own" on public.app_users;
create policy "app_users_update_own"
on public.app_users for update
using (public.current_shop_owner_id() = coalesce(company_owner_id, id))
with check (public.current_shop_owner_id() = coalesce(company_owner_id, id));

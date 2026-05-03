create or replace function public.row_belongs_to_current_shop(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_shop_owner_id() = coalesce(au.company_owner_id, au.id, target_user_id)
  from public.app_users au
  where au.id = target_user_id
  union all
  select public.current_shop_owner_id() = target_user_id
  where not exists (
    select 1
    from public.app_users au
    where au.id = target_user_id
  )
  limit 1
$$;

drop policy if exists "suppliers_owner_all" on public.suppliers;
create policy "suppliers_owner_all"
on public.suppliers for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "customers_owner_all" on public.customers;
create policy "customers_owner_all"
on public.customers for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "customer_credits_owner_all" on public.customer_credits;
create policy "customer_credits_owner_all"
on public.customer_credits for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all"
on public.products for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "sales_owner_all" on public.sales;
create policy "sales_owner_all"
on public.sales for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "sales_returns_owner_all" on public.sales_returns;
create policy "sales_returns_owner_all"
on public.sales_returns for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "expenses_owner_all" on public.expenses;
create policy "expenses_owner_all"
on public.expenses for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "purchase_orders_owner_all" on public.purchase_orders;
create policy "purchase_orders_owner_all"
on public.purchase_orders for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

drop policy if exists "business_documents_owner_all" on public.business_documents;
create policy "business_documents_owner_all"
on public.business_documents for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));

create or replace function public.current_shop_owner_id()
returns uuid
language sql
stable
as $$
  select coalesce(au.company_owner_id, au.id)
  from public.app_users au
  where au.id = auth.uid()
$$;

drop policy if exists "suppliers_owner_all" on public.suppliers;
create policy "suppliers_owner_all"
on public.suppliers for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "customers_owner_all" on public.customers;
create policy "customers_owner_all"
on public.customers for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "customer_credits_owner_all" on public.customer_credits;
create policy "customer_credits_owner_all"
on public.customer_credits for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all"
on public.products for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "sales_owner_all" on public.sales;
create policy "sales_owner_all"
on public.sales for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "sales_returns_owner_all" on public.sales_returns;
create policy "sales_returns_owner_all"
on public.sales_returns for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "expenses_owner_all" on public.expenses;
create policy "expenses_owner_all"
on public.expenses for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "purchase_orders_owner_all" on public.purchase_orders;
create policy "purchase_orders_owner_all"
on public.purchase_orders for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "business_documents_owner_all" on public.business_documents;
create policy "business_documents_owner_all"
on public.business_documents for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

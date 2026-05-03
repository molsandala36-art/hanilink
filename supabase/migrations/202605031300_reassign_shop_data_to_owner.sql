update public.products p
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where p.user_id = au.id
  and p.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.suppliers s
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where s.user_id = au.id
  and s.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.customers c
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where c.user_id = au.id
  and c.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.customer_credits cc
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where cc.user_id = au.id
  and cc.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.sales s
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where s.user_id = au.id
  and s.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.sales_returns sr
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where sr.user_id = au.id
  and sr.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.expenses e
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where e.user_id = au.id
  and e.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.purchase_orders po
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where po.user_id = au.id
  and po.user_id is distinct from coalesce(au.company_owner_id, au.id);

update public.business_documents bd
set user_id = coalesce(au.company_owner_id, au.id)
from public.app_users au
where bd.user_id = au.id
  and bd.user_id is distinct from coalesce(au.company_owner_id, au.id);

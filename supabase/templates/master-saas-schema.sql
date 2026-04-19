create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.saas_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  owner_email text not null default '',
  supabase_project_ref text not null default '',
  supabase_url text not null,
  supabase_publishable_key text not null,
  api_base_url text not null,
  default_locale text not null default 'fr',
  license_enforcement_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saas_tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.saas_tenants(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saas_tenant_admins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.saas_tenants(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'owner',
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, email)
);

create table if not exists public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.saas_tenants(id) on delete cascade,
  plan text not null default 'starter',
  billing_cycle text not null default 'monthly',
  seats integer not null default 1,
  status text not null default 'active',
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saas_provisioning_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  requested_by text not null default '',
  status text not null default 'draft',
  notes text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists saas_tenants_status_idx on public.saas_tenants(status, created_at desc);
create index if not exists saas_subscriptions_tenant_idx on public.saas_subscriptions(tenant_id, created_at desc);
create index if not exists saas_provisioning_runs_slug_idx on public.saas_provisioning_runs(tenant_slug, created_at desc);

drop trigger if exists set_saas_tenants_updated_at on public.saas_tenants;
create trigger set_saas_tenants_updated_at
before update on public.saas_tenants
for each row execute function public.set_updated_at();

drop trigger if exists set_saas_subscriptions_updated_at on public.saas_subscriptions;
create trigger set_saas_subscriptions_updated_at
before update on public.saas_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_saas_provisioning_runs_updated_at on public.saas_provisioning_runs;
create trigger set_saas_provisioning_runs_updated_at
before update on public.saas_provisioning_runs
for each row execute function public.set_updated_at();

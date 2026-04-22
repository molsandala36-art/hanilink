export interface TenantProvisioningInput {
  slug: string;
  name: string;
  ownerEmail: string;
  domain: string;
  supabaseUrl: string;
  publishableKey: string;
  projectRef: string;
  plan: string;
  billingCycle: string;
  licenseEnforcement: boolean;
}

export interface TenantProvisioningPayload {
  tenantConfig: Record<string, any>;
  envSnippet: string;
  masterInsertSql: string;
  checklist: string[];
}

const sqlEscape = (value: string) => value.replace(/'/g, "''");

export const normalizeSupabaseProjectUrl = (value: string) =>
  value.trim().replace(/\/functions\/v1$/i, '').replace(/\/+$/, '').toLowerCase();

export const extractSupabaseProjectRef = (value: string) => {
  const normalized = normalizeSupabaseProjectUrl(value);
  const match = normalized.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  return match?.[1]?.toLowerCase() || '';
};

export const isSameSupabaseProject = (left: string, right: string) => {
  const normalizedLeft = normalizeSupabaseProjectUrl(left);
  const normalizedRight = normalizeSupabaseProjectUrl(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftRef = extractSupabaseProjectRef(normalizedLeft);
  const rightRef = extractSupabaseProjectRef(normalizedRight);

  return leftRef.length > 0 && leftRef === rightRef;
};

export const generateTenantProvisioningPayload = (
  input: TenantProvisioningInput
): TenantProvisioningPayload => {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim() || slug;
  const ownerEmail = input.ownerEmail.trim();
  const domain = input.domain.trim().toLowerCase();
  const supabaseUrl = input.supabaseUrl.trim().replace(/\/+$/, '');
  const publishableKey = input.publishableKey.trim();
  const projectRef = input.projectRef.trim();
  const plan = input.plan.trim() || 'starter';
  const billingCycle = input.billingCycle.trim() || 'monthly';
  const apiBaseUrl = `${supabaseUrl}/functions/v1`;

  const tenantConfig = {
    [slug]: {
      name,
      domains: domain ? [domain] : [],
      supabaseUrl,
      supabasePublishableKey: publishableKey,
      apiBaseUrl,
    },
  };

  const masterInsertSql = `
insert into public.saas_tenants (
  slug,
  name,
  owner_email,
  supabase_project_ref,
  supabase_url,
  supabase_publishable_key,
  api_base_url,
  license_enforcement_enabled,
  metadata
)
values (
  '${sqlEscape(slug)}',
  '${sqlEscape(name)}',
  '${sqlEscape(ownerEmail)}',
  '${sqlEscape(projectRef)}',
  '${sqlEscape(supabaseUrl)}',
  '${sqlEscape(publishableKey)}',
  '${sqlEscape(apiBaseUrl)}',
  ${input.licenseEnforcement ? 'true' : 'false'},
  jsonb_build_object(
    'plan', '${sqlEscape(plan)}',
    'billingCycle', '${sqlEscape(billingCycle)}'
  )
)
on conflict (slug) do update
set
  name = excluded.name,
  owner_email = excluded.owner_email,
  supabase_project_ref = excluded.supabase_project_ref,
  supabase_url = excluded.supabase_url,
  supabase_publishable_key = excluded.supabase_publishable_key,
  api_base_url = excluded.api_base_url,
  license_enforcement_enabled = excluded.license_enforcement_enabled,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

insert into public.saas_tenant_domains (tenant_id, domain, is_primary)
select id, '${sqlEscape(domain)}', true
from public.saas_tenants
where slug = '${sqlEscape(slug)}'
${domain ? 'on conflict (domain) do nothing;' : ';'}
  `.trim();

  return {
    tenantConfig,
    envSnippet: `VITE_TENANT_CONFIGS=${JSON.stringify(
      tenantConfig
    )}\nVITE_DEFAULT_TENANT=${slug}\nVITE_ENABLE_LICENSE_ENFORCEMENT=${
      input.licenseEnforcement ? 'true' : 'false'
    }`,
    masterInsertSql,
    checklist: [
      'Creer le projet Supabase du client',
      'Appliquer supabase/templates/client-app-schema.sql',
      input.licenseEnforcement
        ? 'Appliquer la migration licensing et deployer les Edge Functions'
        : 'Laisser le licensing desactive pour ce client',
      'Ajouter ou fusionner le bloc dans VITE_TENANT_CONFIGS',
      `Definir VITE_DEFAULT_TENANT=${slug} si ce client doit etre le defaut`,
      'Redeployer le frontend web',
      domain ? `Mapper le domaine ${domain} vers le frontend` : 'Configurer un domaine dedie si besoin',
    ],
  };
};

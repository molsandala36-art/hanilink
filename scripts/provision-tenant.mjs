import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

const getArg = (name, fallback = '') => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : fallback;
};

const slug = getArg('slug');
const name = getArg('name') || slug;
const ownerEmail = getArg('owner-email');
const domain = getArg('domain');
const supabaseUrl = getArg('supabase-url');
const publishableKey = getArg('publishable-key');
const projectRef = getArg('project-ref');
const plan = getArg('plan', 'starter');
const billingCycle = getArg('billing-cycle', 'monthly');
const licenseMode = getArg('license-enforcement', 'false');

if (!slug || !supabaseUrl || !publishableKey) {
  console.error(
    [
      'Usage:',
      'node scripts/provision-tenant.mjs --slug=client-a --name="Client A" --owner-email=owner@example.com --domain=client-a.hanilink.app --supabase-url=https://client-a.supabase.co --publishable-key=sb_publishable_xxx --project-ref=abc123',
    ].join('\n')
  );
  process.exit(1);
}

const apiBaseUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`;
const licenseEnforcementEnabled = /^(1|true|yes|on)$/i.test(licenseMode);

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
  '${slug}',
  '${name.replace(/'/g, "''")}',
  '${ownerEmail.replace(/'/g, "''")}',
  '${projectRef.replace(/'/g, "''")}',
  '${supabaseUrl}',
  '${publishableKey}',
  '${apiBaseUrl}',
  ${licenseEnforcementEnabled ? 'true' : 'false'},
  jsonb_build_object(
    'plan', '${plan}',
    'billingCycle', '${billingCycle}'
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
select id, '${domain}', true
from public.saas_tenants
where slug = '${slug}'
${domain ? 'on conflict (domain) do nothing;' : ';'}
`.trim();

const payload = {
  tenantConfig,
  envSnippet: `VITE_TENANT_CONFIGS=${JSON.stringify(tenantConfig)}\nVITE_DEFAULT_TENANT=${slug}\nVITE_ENABLE_LICENSE_ENFORCEMENT=${licenseEnforcementEnabled ? 'true' : 'false'}`,
  masterInsertSql,
  checklist: [
    'Create the Supabase client project',
    'Apply supabase/templates/client-app-schema.sql in the client project',
    licenseEnforcementEnabled ? 'Apply licensing migration and deploy licensing edge functions' : 'Skip licensing for now',
    'Add or merge the tenant entry into VITE_TENANT_CONFIGS',
    `Set VITE_DEFAULT_TENANT=${slug} if this should be the default tenant`,
    'Deploy or redeploy the frontend',
    domain ? `Map the domain ${domain} to the frontend deployment` : 'Optional: map a dedicated domain',
  ],
};

const outputDir = path.join(process.cwd(), 'dist', 'tenant-provisioning');
fs.mkdirSync(outputDir, { recursive: true });
const outputFile = path.join(outputDir, `${slug}.json`);
fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2));

console.log(JSON.stringify(payload, null, 2));
console.log(`\nSaved provisioning payload to ${outputFile}`);

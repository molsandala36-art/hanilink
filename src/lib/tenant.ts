export interface TenantConfig {
  slug: string;
  name?: string;
  domains?: string[];
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  apiBaseUrl?: string;
  allowRegistration?: boolean;
}

const TENANT_STORAGE_KEY = 'hani_tenant_slug';

const rawTenantConfigs = (import.meta.env.VITE_TENANT_CONFIGS || '').trim();
const rawDefaultTenant = (import.meta.env.VITE_DEFAULT_TENANT || '').trim();
const rawLegacyApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const rawLegacySupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawLegacySupabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

const normalizeTenant = (tenant: Partial<TenantConfig>, fallbackSlug: string): TenantConfig => ({
  slug: String(tenant.slug || fallbackSlug).trim().toLowerCase(),
  name: tenant.name?.trim() || fallbackSlug,
  domains: Array.isArray(tenant.domains)
    ? tenant.domains.map((domain) => String(domain).trim().toLowerCase()).filter(Boolean)
    : [],
  supabaseUrl: tenant.supabaseUrl?.trim() || '',
  supabasePublishableKey: tenant.supabasePublishableKey?.trim() || '',
  apiBaseUrl: tenant.apiBaseUrl?.trim() || '',
  allowRegistration: tenant.allowRegistration !== false,
});

const parseTenantConfigs = () => {
  if (!rawTenantConfigs) {
    return [] as TenantConfig[];
  }

  try {
    const parsed = JSON.parse(rawTenantConfigs);
    if (Array.isArray(parsed)) {
      return parsed
        .map((tenant, index) => normalizeTenant(tenant || {}, `tenant-${index + 1}`))
        .filter((tenant) => tenant.slug);
    }

    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([slug, tenant]) =>
        normalizeTenant((tenant as Partial<TenantConfig>) || {}, slug)
      );
    }
  } catch (error) {
    console.error('Invalid VITE_TENANT_CONFIGS payload', error);
  }

  return [] as TenantConfig[];
};

const configuredTenants = parseTenantConfigs();

const legacyTenant =
  rawLegacySupabaseUrl || rawLegacySupabasePublishableKey || rawLegacyApiBaseUrl
    ? normalizeTenant(
        {
          slug: rawDefaultTenant || 'default',
          name: 'Default Tenant',
          supabaseUrl: rawLegacySupabaseUrl,
          supabasePublishableKey: rawLegacySupabasePublishableKey,
          apiBaseUrl: rawLegacyApiBaseUrl,
        },
        rawDefaultTenant || 'default'
      )
    : null;

const tenantCatalog = configuredTenants.length > 0 ? configuredTenants : legacyTenant ? [legacyTenant] : [];

const isLocalHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

const getHostname = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hostname.toLowerCase();
};

const findTenantByDomain = (hostname: string) =>
  tenantCatalog.find((tenant) => tenant.domains?.some((domain) => domain === hostname));

const findTenantBySlug = (slug?: string | null) => {
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  return tenantCatalog.find((tenant) => tenant.slug === normalizedSlug) || null;
};

const findTenantFromQuery = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const slug = new URLSearchParams(window.location.search).get('tenant');
  return findTenantBySlug(slug);
};

export const getStoredTenantSlug = () => {
  if (typeof window === 'undefined') {
    return rawDefaultTenant || tenantCatalog[0]?.slug || '';
  }

  return window.localStorage.getItem(TENANT_STORAGE_KEY)?.trim().toLowerCase() || '';
};

export const setPreferredTenantSlug = (slug: string) => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (typeof window === 'undefined') {
    return normalizedSlug;
  }

  if (!normalizedSlug) {
    window.localStorage.removeItem(TENANT_STORAGE_KEY);
    return '';
  }

  window.localStorage.setItem(TENANT_STORAGE_KEY, normalizedSlug);
  return normalizedSlug;
};

export const getAvailableTenants = () => tenantCatalog;

export const getDefaultTenant = () =>
  findTenantBySlug(rawDefaultTenant) || tenantCatalog[0] || null;

export const resolveTenantConfig = () => {
  const hostname = getHostname();
  const queryTenant = findTenantFromQuery();
  if (queryTenant) {
    return queryTenant;
  }

  const storedTenant = findTenantBySlug(getStoredTenantSlug());
  if (storedTenant) {
    return storedTenant;
  }

  if (hostname && !isLocalHost(hostname)) {
    const hostnameTenant = findTenantByDomain(hostname) || findTenantBySlug(hostname.split('.')[0]);
    if (hostnameTenant) {
      return hostnameTenant;
    }
  }

  return getDefaultTenant();
};

export const getTenantResolutionIssue = () => {
  if (tenantCatalog.length === 0) {
    return "Aucun tenant n'est configure. Ajoute VITE_TENANT_CONFIGS ou une configuration Supabase par defaut.";
  }

  const tenant = resolveTenantConfig();
  if (!tenant) {
    return "Impossible d'identifier l'espace client courant. Choisis un slug client ou configure un mapping de domaine.";
  }

  return null;
};

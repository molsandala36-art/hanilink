import { getTenantResolutionIssue, resolveTenantConfig } from './tenant';

const rawLicenseEnforcement = (import.meta.env.VITE_ENABLE_LICENSE_ENFORCEMENT || '').trim();

const isSupabaseHost = (value: string) =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co(?:\/.*)?$/i.test(value);

export const isLicenseEnforcementEnabled = /^(1|true|yes|on)$/i.test(rawLicenseEnforcement);

export const getActiveTenantConfig = () => resolveTenantConfig();

export const getApiBaseUrl = () => {
  const tenant = getActiveTenantConfig();
  return tenant?.apiBaseUrl?.replace(/\/+$/, '') || '/api';
};

export const isExternalApiConfigured = () => getApiBaseUrl() !== '/api';

export const getSupabaseUrl = () => {
  const tenant = getActiveTenantConfig();
  const rawApiBaseUrl = tenant?.apiBaseUrl?.trim() || '';
  const rawSupabaseUrl = tenant?.supabaseUrl?.trim() || '';

  return (
    rawSupabaseUrl ||
    (isSupabaseHost(rawApiBaseUrl) ? rawApiBaseUrl.replace(/\/functions\/v1$/i, '') : '')
  ).replace(/\/+$/, '');
};

export const getSupabasePublishableKey = () => getActiveTenantConfig()?.supabasePublishableKey?.trim() || '';

export const isSupabaseConfigured = () => {
  const supabaseUrl = getSupabaseUrl();
  const supabasePublishableKey = getSupabasePublishableKey();
  return supabaseUrl.length > 0 && supabasePublishableKey.length > 0;
};

export const isBareSupabaseProjectUrl = () => {
  const apiBaseUrl = getApiBaseUrl();
  return isSupabaseHost(apiBaseUrl) && !/\/functions\/v1$/i.test(apiBaseUrl);
};

export const isSupabaseFunctionsBaseUrl = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1$/i.test(getApiBaseUrl());

export const getBackendSetupIssue = () => {
  const tenantIssue = getTenantResolutionIssue();
  if (tenantIssue) {
    return tenantIssue;
  }

  const supabaseUrl = getSupabaseUrl();
  const supabasePublishableKey = getSupabasePublishableKey();

  if (supabaseUrl && !supabasePublishableKey) {
    return "VITE_SUPABASE_URL est defini, mais VITE_SUPABASE_PUBLISHABLE_KEY manque encore pour activer l'authentification Supabase.";
  }

  if (isSupabaseConfigured()) {
    return null;
  }

  if (isBareSupabaseProjectUrl()) {
    return "VITE_API_BASE_URL pointe vers la racine Supabase. Utilise plutot l'URL des Edge Functions, par exemple https://<project-ref>.supabase.co/functions/v1.";
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isHostedFrontend = !isLocalHost;

  if (!isExternalApiConfigured() && isHostedFrontend) {
    return "Le frontend deploye n'a pas de backend externe configure. Ajoute VITE_API_BASE_URL dans Vercel pour pointer vers ton backend Supabase.";
  }

  return null;
};

export const getApiErrorMessage = (error: any, fallbackMessage: string) => {
  const setupIssue = getBackendSetupIssue();
  if (setupIssue) {
    return setupIssue;
  }

  if (error?.response?.status === 404 && isSupabaseFunctionsBaseUrl()) {
    return "Le backend Supabase repond, mais cette route n'existe pas dans tes Edge Functions. Il faut mapper les endpoints du frontend vers les vraies fonctions Supabase.";
  }

  return error?.response?.data?.message || fallbackMessage;
};

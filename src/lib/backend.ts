const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawSupabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '');
export const isExternalApiConfigured = apiBaseUrl.length > 0;

const isSupabaseHost = (value: string) =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co(?:\/.*)?$/i.test(value);

export const isBareSupabaseProjectUrl =
  isSupabaseHost(apiBaseUrl) && !/\/functions\/v1$/i.test(apiBaseUrl);

export const isSupabaseFunctionsBaseUrl =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1$/i.test(apiBaseUrl);

export const supabaseUrl = (
  rawSupabaseUrl ||
  (isSupabaseHost(apiBaseUrl) ? apiBaseUrl.replace(/\/functions\/v1$/i, '') : '')
).replace(/\/+$/, '');

export const supabasePublishableKey = rawSupabasePublishableKey;
export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabasePublishableKey.length > 0;

export const getApiBaseUrl = () => apiBaseUrl || '/api';

export const getBackendSetupIssue = () => {
  if (supabaseUrl && !supabasePublishableKey) {
    return "VITE_SUPABASE_URL est defini, mais VITE_SUPABASE_PUBLISHABLE_KEY manque encore pour activer l'authentification Supabase.";
  }

  if (isSupabaseConfigured) {
    return null;
  }

  if (isBareSupabaseProjectUrl) {
    return "VITE_API_BASE_URL pointe vers la racine Supabase. Utilise plutot l'URL des Edge Functions, par exemple https://<project-ref>.supabase.co/functions/v1.";
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isHostedFrontend = !isLocalHost;

  if (!isExternalApiConfigured && isHostedFrontend) {
    return "Le frontend deploye n'a pas de backend externe configure. Ajoute VITE_API_BASE_URL dans Vercel pour pointer vers ton backend Supabase.";
  }

  return null;
};

export const getApiErrorMessage = (error: any, fallbackMessage: string) => {
  const setupIssue = getBackendSetupIssue();
  if (setupIssue) {
    return setupIssue;
  }

  if (error?.response?.status === 404 && isSupabaseFunctionsBaseUrl) {
    return "Le backend Supabase repond, mais cette route n'existe pas dans tes Edge Functions. Il faut mapper les endpoints du frontend vers les vraies fonctions Supabase.";
  }

  return error?.response?.data?.message || fallbackMessage;
};

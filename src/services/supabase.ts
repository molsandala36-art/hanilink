import { createClient } from '@supabase/supabase-js';
import type { LockFunc } from '@supabase/auth-js';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { getActiveTenantConfig, getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '../lib/backend';

type AppUserRole = 'admin' | 'employee';

interface AppUserRow {
  id: string;
  name: string;
  email: string;
  company_owner_id?: string | null;
  shop_name?: string;
  ice?: string;
  if_value?: string;
  rc?: string;
  address?: string;
  role?: string;
  permissions?: Record<string, any> | null;
  created_at?: string;
}

export interface AppUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  shopName: string;
  companyOwnerId?: string;
  ice?: string;
  if?: string;
  rc?: string;
  address?: string;
  role: AppUserRole;
  createdAt: string;
}

const browserLockQueue = new Map<string, Promise<unknown>>();

const browserLock: LockFunc = async <R>(name: string, _acquireTimeout: number, fn: () => Promise<R>) => {
  const previous = browserLockQueue.get(name) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  browserLockQueue.set(
    name,
    previous
      .catch(() => undefined)
      .then(() => current)
  );

  await previous.catch(() => undefined);

  try {
    return await fn();
  } finally {
    release();
    if (browserLockQueue.get(name) === current) {
      browserLockQueue.delete(name);
    }
  }
};

const supabaseClients = new Map<string, SupabaseClient>();
const sessionCache = new Map<string, Session | null>();
const sessionPromiseCache = new Map<string, Promise<Session | null>>();

const normalizeRole = (value: unknown): AppUserRole =>
  value === 'admin' ? 'admin' : 'employee';

const mapProfileRowToAppUser = (row: AppUserRow, fallbackUser?: User): AppUser => ({
  _id: row.id,
  id: row.id,
  name: row.name || fallbackUser?.email?.split('@')[0] || 'Utilisateur',
  email: row.email || fallbackUser?.email || '',
  shopName: row.shop_name || 'HaniLink',
  companyOwnerId: row.company_owner_id || row.id,
  ice: row.ice || '',
  if: row.if_value || '',
  rc: row.rc || '',
  address: row.address || '',
  role: normalizeRole(row.role),
  createdAt: row.created_at || fallbackUser?.created_at || new Date().toISOString(),
});

export const normalizeSupabaseUser = (user: User): AppUser => {
  const metadata = user.user_metadata || {};
  const fallbackName = user.email?.split('@')[0] || 'Utilisateur';

  return {
    _id: user.id,
    id: user.id,
    name: metadata.name || metadata.full_name || fallbackName,
    email: user.email || '',
    shopName: metadata.shopName || metadata.shop_name || 'HaniLink',
    companyOwnerId: user.id,
    ice: metadata.ice || '',
    if: metadata.if || '',
    rc: metadata.rc || '',
    address: metadata.address || '',
    role: normalizeRole(metadata.role),
    createdAt: user.created_at || new Date().toISOString(),
  };
};

const getTenantSessionKey = () => getActiveTenantConfig()?.slug || 'default';

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const tenant = getActiveTenantConfig();
  const tenantKey = tenant?.slug || 'default';
  const existingClient = supabaseClients.get(tenantKey);
  if (existingClient) {
    return existingClient;
  }

  const client = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      lock: browserLock,
      storageKey: `hani-sb-${tenantKey}`,
    },
  });

  supabaseClients.set(tenantKey, client);
  return client;
};

export const supabase = getSupabaseClient();

const requireSupabase = () => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("L'authentification Supabase n'est pas configuree.");
  }

  return client;
};

const upsertAppUserProfile = async (
  user: User,
  overrides?: Partial<{
    name: string;
    shopName: string;
    role: AppUserRole;
    companyOwnerId: string;
    ice: string;
    ifValue: string;
    rc: string;
    address: string;
  }>
) => {
  const client = requireSupabase();
  const fallback = normalizeSupabaseUser(user);
  const row = {
    id: user.id,
    name: overrides?.name ?? fallback.name,
    email: user.email || '',
    company_owner_id: overrides?.companyOwnerId ?? user.id,
    shop_name: overrides?.shopName ?? fallback.shopName,
    ice: overrides?.ice ?? fallback.ice ?? '',
    if_value: overrides?.ifValue ?? fallback.if ?? '',
    rc: overrides?.rc ?? fallback.rc ?? '',
    address: overrides?.address ?? fallback.address ?? '',
    role: overrides?.role ?? fallback.role,
  };

  const { data, error } = await client
    .from('app_users')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapProfileRowToAppUser(data as AppUserRow, user);
};

export const getCurrentSupabaseUserProfile = async (user?: User): Promise<AppUser> => {
  const client = requireSupabase();
  const session = await getStoredSupabaseSession();
  const authUser = user || session?.user || (await client.auth.getUser()).data.user;

  if (!authUser) {
    throw new Error('Utilisateur Supabase introuvable.');
  }

  const { data, error } = await client
    .from('app_users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return upsertAppUserProfile(authUser);
  }

  return mapProfileRowToAppUser(data as AppUserRow, authUser);
};

export const getStoredSupabaseSession = async (): Promise<Session | null> => {
  const client = requireSupabase();
  const sessionKey = getTenantSessionKey();
  const cachedSession = sessionCache.get(sessionKey);
  if (cachedSession) {
    return cachedSession;
  }

  const existingPromise = sessionPromiseCache.get(sessionKey);
  if (existingPromise) {
    return existingPromise;
  }

  const sessionPromise = (async () => {
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    sessionCache.set(sessionKey, data.session);
    return data.session;
  })();

  sessionPromiseCache.set(sessionKey, sessionPromise);

  try {
    return await sessionPromise;
  } finally {
    sessionPromiseCache.delete(sessionKey);
  }
};

export const setCachedSupabaseSession = (session: Session | null) => {
  sessionCache.set(getTenantSessionKey(), session);
};

export const getSupabaseAccessToken = async () => {
  const session = await getStoredSupabaseSession();
  return session?.access_token || '';
};

export const signInWithSupabase = async (email: string, password: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  if (!data.session || !data.user) {
    throw new Error('Session Supabase introuvable apres connexion.');
  }

  const profile = await getCurrentSupabaseUserProfile(data.user);

  return {
    token: data.session.access_token,
    user: profile,
  };
};

export const signUpWithSupabase = async (payload: {
  name: string;
  email: string;
  password: string;
  shopName: string;
}) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        name: payload.name,
        shopName: payload.shopName,
        role: 'admin',
      },
    },
  });

  if (error) {
    throw error;
  }

  let profile: AppUser | null = null;
  if (data.user && data.session) {
    profile = await upsertAppUserProfile(data.user, {
      name: payload.name,
      shopName: payload.shopName,
      role: 'admin',
      companyOwnerId: data.user.id,
    });
  }

  return {
    token: data.session?.access_token || '',
    user: profile,
    needsEmailConfirmation: !data.session,
  };
};

export const signOutFromSupabase = async () => {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }

  setCachedSupabaseSession(null);
};

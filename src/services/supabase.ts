import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from '../lib/backend';

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

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

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

const requireSupabase = () => {
  if (!supabase) {
    throw new Error("L'authentification Supabase n'est pas configuree.");
  }

  return supabase;
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
  const authUser = user || (await client.auth.getUser()).data.user;

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
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
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
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from '../lib/backend';

type AppUserRole = 'admin' | 'employee';

export interface AppUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  shopName: string;
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

export const normalizeSupabaseUser = (user: User): AppUser => {
  const metadata = user.user_metadata || {};
  const fallbackName = user.email?.split('@')[0] || 'Utilisateur';

  return {
    _id: user.id,
    id: user.id,
    name: metadata.name || metadata.full_name || fallbackName,
    email: user.email || '',
    shopName: metadata.shopName || metadata.shop_name || 'HaniLink',
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

  return {
    token: data.session.access_token,
    user: normalizeSupabaseUser(data.user),
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

  return {
    token: data.session?.access_token || '',
    user: data.user ? normalizeSupabaseUser(data.user) : null,
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

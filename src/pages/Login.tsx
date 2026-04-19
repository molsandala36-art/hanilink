import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Loader2 } from 'lucide-react';
import api from '../services/api';
import { getBackendSetupIssue, isSupabaseConfigured } from '../lib/backend';
import TenantField from '../components/TenantField';
import { getStoredTenantSlug, setPreferredTenantSlug } from '../lib/tenant';
import { signInWithSupabase } from '../services/supabase';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState(getStoredTenantSlug());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const backendSetupIssue = getBackendSetupIssue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setPreferredTenantSlug(tenantSlug);
      if (isSupabaseConfigured()) {
        const result = await signInWithSupabase(email, password);
        onLogin(result.token, result.user);
      } else {
        const res = await api.post('/auth/login', { email, password });
        onLogin(res.data.token, res.data.user);
      }
    } catch (err: any) {
      setError(err?.message || err?.response?.data?.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-orange-500 p-3 rounded-2xl mb-4">
            <Store className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HaniLink</h1>
          <p className="text-gray-500 dark:text-gray-400">Gérez votre commerce en toute simplicité</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {backendSetupIssue && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm font-medium border border-amber-200">
              {backendSetupIssue}
            </div>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}
          <TenantField value={tenantSlug} onChange={setTenantSlug} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              autoComplete="username"
              required
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mot de passe</label>
              <Link to="/forgot-password" className="text-xs text-orange-600 hover:underline font-medium">
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-orange-600 font-bold hover:underline">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

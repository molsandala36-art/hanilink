import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Loader2 } from 'lucide-react';
import api from '../services/api';
import { getBackendSetupIssue, isSupabaseConfigured } from '../lib/backend';
import { signUpWithSupabase } from '../services/supabase';

interface RegisterProps {
  onLogin: (token: string, user: any) => void;
}

const Register = ({ onLogin }: RegisterProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    shopName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const backendSetupIssue = getBackendSetupIssue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (isSupabaseConfigured) {
        const result = await signUpWithSupabase(formData);
        if (result.needsEmailConfirmation || !result.token || !result.user) {
          setSuccess("Compte cree. Confirme ton email Supabase puis connecte-toi.");
        } else {
          onLogin(result.token, result.user);
        }
      } else {
        const res = await api.post('/auth/register', formData);
        onLogin(res.data.token, res.data.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'inscription');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inscription HaniLink</h1>
          <p className="text-gray-500 dark:text-gray-400">Commencez à gérer votre boutique dès aujourd'hui</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {backendSetupIssue && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm font-medium border border-amber-200">
              {backendSetupIssue}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm font-medium border border-green-200">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom complet</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de la boutique</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white"
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-orange-600 font-bold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

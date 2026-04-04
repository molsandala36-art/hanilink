import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Key, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { translations, Language } from '../lib/translations';

const AdminLicensing = () => {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [language] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const t = translations[language];

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      const res = await api.get('/admin/licenses');
      setLicenses(res.data);
    } catch (err) {
      setError('Failed to fetch licenses');
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/admin/licenses', {});
      setLicenses([res.data, ...licenses]);
      setSuccess('License key generated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to generate license key');
    } finally {
      setGenerating(false);
    }
  };

  const deleteLicense = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this license?')) return;
    try {
      await api.delete(`/admin/licenses/${id}`);
      setLicenses(licenses.filter(l => l._id !== id));
    } catch (err) {
      setError('Failed to delete license');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Key copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-orange-500" />
            {t.licensing}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage software activation keys and hardware locks.
          </p>
        </div>
        <button
          onClick={generateKey}
          disabled={generating}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none flex items-center gap-2"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          Generate New Key
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">License Key</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">HWID Lock</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Created At</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No license keys found.
                  </td>
                </tr>
              ) : (
                licenses.map((license) => (
                  <tr key={license._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg text-orange-600 dark:text-orange-400 font-mono font-bold">
                          {license.key}
                        </code>
                        <button 
                          onClick={() => copyToClipboard(license.key)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        license.active 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {license.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                          {license.hwid || 'Not Locked'}
                        </span>
                        {license.activatedAt && (
                          <span className="text-xs text-gray-400">
                            Activated: {new Date(license.activatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(license.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => deleteLicense(license._id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLicensing;

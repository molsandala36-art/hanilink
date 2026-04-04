import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { UserPlus, Trash2, Shield, User as UserIcon, X, Edit2 } from 'lucide-react';
import { translations, Language } from '../lib/translations';
import { cn } from '../lib/utils';

interface User {
  _id: string;
  name: string;
  email: string;
  shopName: string;
  role: 'admin' | 'employee';
  createdAt: string;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    shopName: JSON.parse(localStorage.getItem('user') || '{}').shopName || '',
    role: 'employee' as 'admin' | 'employee'
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    shopName: ''
  });
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const t = translations[language];

  useEffect(() => {
    fetchUsers();

    const handleLangChange = () => {
      setLanguage((localStorage.getItem('language') as Language) || 'fr');
    };
    window.addEventListener('storage', handleLangChange);
    const interval = setInterval(handleLangChange, 1000);
    return () => {
      window.removeEventListener('storage', handleLangChange);
      clearInterval(interval);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des utilisateurs');
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', formData);
      setShowAddModal(false);
      setFormData({ ...formData, name: '', email: '', password: '', role: 'employee' });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de l\'ajout de l\'utilisateur');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!window.confirm(t.confirm_edit_user)) return;
    try {
      await api.put(`/users/${editingUser._id}`, editFormData);
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm(t.confirm_delete_user)) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleUpdateRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'employee' : 'admin';
    if (!window.confirm(t.confirm_change_role)) return;
    try {
      await api.put(`/users/${id}/role`, { role: newRole });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour du rôle');
    }
  };

  if (loading) return <div className="flex justify-center p-8 text-gray-500 dark:text-gray-400">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestion des Utilisateurs</h1>
          <p className="text-gray-500 dark:text-gray-400">Gérez les accès de votre boutique</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Ajouter un utilisateur
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-100 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Utilisateur</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Rôle</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Boutique</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Date d'ajout</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {users.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">{u.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => handleUpdateRole(u._id, u.role)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer hover:opacity-80",
                      u.role === 'admin' 
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' 
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    )}
                  >
                    <Shield className="w-3 h-3" />
                    {u.role === 'admin' ? t.admin : t.employee}
                  </button>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{u.shopName}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(u.createdAt).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditFormData({
                          name: u.name,
                          email: u.email,
                          shopName: u.shopName
                        });
                        setShowEditModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title={t.edit_product}
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u._id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Ajouter un utilisateur</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rôle</label>
                <select
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'employee' })}
                >
                  <option value="employee">Employé</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t.edit_user}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الاسم الكامل' : 'Nom complet'}</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.shop_name}</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  value={editFormData.shopName}
                  onChange={(e) => setEditFormData({ ...editFormData, shopName: e.target.value })}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  {language === 'ar' ? 'حفظ' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;

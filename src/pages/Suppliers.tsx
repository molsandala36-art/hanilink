import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Truck, Plus, Search, Trash2, Edit2, Loader2, AlertCircle, CheckCircle2, Phone, Mail, MapPin, X } from 'lucide-react';
import api from '../services/api';
import { translations, Language } from '../lib/translations';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [language] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    ice: ''
  });

  const t = translations[language];

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier._id}`, formData);
      } else {
        await api.post('/suppliers', formData);
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: '', contact: '', email: '', phone: '', address: '', ice: '' });
      fetchSuppliers();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!window.confirm(t.confirm_delete_user)) return;
    try {
      await api.delete(`/suppliers/${id}`);
      fetchSuppliers();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Truck className="w-10 h-10 text-orange-500" />
            {t.suppliers}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your vendors and supply chain contacts.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(null);
            setFormData({ name: '', contact: '', email: '', phone: '', address: '', ice: '' });
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {language === 'fr' ? 'Ajouter un fournisseur' : 'إضافة مورد'}
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t.search_product}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white shadow-sm transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
            No suppliers found.
          </div>
        ) : (
          filteredSuppliers.map((supplier) => (
            <motion.div
              key={supplier._id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-orange-500" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingSupplier(supplier);
                      setFormData({
                        name: supplier.name,
                        contact: supplier.contact,
                        email: supplier.email,
                        phone: supplier.phone,
                        address: supplier.address,
                        ice: supplier.ice || ''
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteSupplier(supplier._id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{supplier.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{supplier.contact}</p>

              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4 text-orange-500" />
                  {supplier.phone}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4 text-orange-500" />
                  {supplier.email}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  {supplier.address}
                </div>
              </div>

              {supplier.ice && (
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ICE</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">{supplier.ice}</p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingSupplier ? (language === 'fr' ? 'Modifier le fournisseur' : 'تعديل المورد') : (language === 'fr' ? 'Ajouter un fournisseur' : 'إضافة مورد')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.product_name}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact</label>
                <input
                  type="text"
                  required
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <textarea
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white h-20 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ICE</label>
                <input
                  type="text"
                  value={formData.ice}
                  onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none"
                >
                  {editingSupplier ? (language === 'fr' ? 'Modifier' : 'تعديل') : (language === 'fr' ? 'Ajouter' : 'إضافة')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;

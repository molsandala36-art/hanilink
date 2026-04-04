import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, Plus, Search, Edit2, Trash2, Loader2, X } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { translations, Language } from '../lib/translations';

interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  expenseDate: string;
  notes?: string;
}

const EMPTY_FORM = {
  title: '',
  amount: '',
  category: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: ''
};

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [language] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const t = translations[language];

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/expenses');
      setExpenses(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const filteredExpenses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return expenses;
    return expenses.filter((expense) =>
      expense.title.toLowerCase().includes(term) ||
      expense.category.toLowerCase().includes(term) ||
      (expense.notes || '').toLowerCase().includes(term)
    );
  }, [expenses, searchTerm]);

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((acc, expense) => acc + expense.amount, 0),
    [filteredExpenses]
  );

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category || '',
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
      notes: expense.notes || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      title: formData.title.trim(),
      amount: Number(formData.amount || 0),
      category: formData.category.trim() || 'General',
      expenseDate: formData.expenseDate,
      notes: formData.notes.trim()
    };

    if (!payload.title || payload.amount <= 0) {
      return;
    }

    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      closeModal();
      fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.confirm_delete_product)) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Wallet className="w-10 h-10 text-orange-500" />
            {t.expenses}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'تتبع جميع مصاريف التشغيل والمصاريف الثابتة.' : 'Suivez toutes vos charges d’exploitation et frais fixes.'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {t.add_expense}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t.search_product}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white shadow-sm transition-all"
          />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t.total_expenses_label}</span>
          <span className="text-lg font-bold text-red-600">{formatCurrency(totalExpenses)}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4">{t.expense_title}</th>
                <th className="px-6 py-4">{t.expense_category}</th>
                <th className="px-6 py-4">{t.expense_date}</th>
                <th className="px-6 py-4">{t.expense_amount}</th>
                <th className="px-6 py-4">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">{t.no_expenses}</td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{expense.title}</p>
                      {expense.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{expense.notes}</p>}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{expense.category || 'General'}</td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{formatDate(expense.expenseDate)}</td>
                    <td className="px-6 py-4 font-bold text-red-600">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(expense)}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingExpense ? t.edit_expense : t.add_expense}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expense_title}</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expense_amount}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expense_date}</label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expense_category}</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expense_notes}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white h-24 resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none"
                >
                  {editingExpense ? t.edit_expense : t.add_expense}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Expenses;

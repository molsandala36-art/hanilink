import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Plus, Search, Wallet, X } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';

interface Customer {
  _id: string;
  name: string;
  phone: string;
  creditLimit: number;
  openingBalance: number;
}

interface CreditEntry {
  _id: string;
  customerId: string;
  amount: number;
  entryType: 'credit' | 'payment';
  paymentMethod: string;
  note: string;
  createdAt: string;
}

const emptyForm = {
  customerId: '',
  amount: '',
  entryType: 'credit',
  paymentMethod: 'cash',
  note: '',
};

const CreditsManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [credits, setCredits] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customersRes, creditsRes] = await Promise.all([api.get('/customers'), api.get('/credits')]);
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setCredits(Array.isArray(creditsRes.data) ? creditsRes.data : []);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || 'Impossible de charger les crédits clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer._id, customer])), [customers]);

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((customer) => map.set(customer._id, Number(customer.openingBalance || 0)));
    credits.forEach((entry) => {
      const current = map.get(entry.customerId) || 0;
      const signedAmount = entry.entryType === 'payment' ? -Number(entry.amount || 0) : Number(entry.amount || 0);
      map.set(entry.customerId, current + signedAmount);
    });
    return map;
  }, [credits, customers]);

  const creditRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return credits.filter((entry) => {
      const customer = customerMap.get(entry.customerId);
      if (!term) return true;
      return [customer?.name || '', entry.note || '', entry.paymentMethod || '', entry.entryType || '']
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [credits, customerMap, searchTerm]);

  const summary = useMemo(
    () => ({
      totalBalance: Array.from(balances.values()).reduce((sum, value) => sum + Number(value || 0), 0),
      totalCustomers: customers.length,
      totalEntries: credits.length,
    }),
    [balances, credits.length, customers.length]
  );

  const openModal = () => {
    setFormData({ ...emptyForm, customerId: customers[0]?._id || '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData(emptyForm);
  };

  const createEntry = async () => {
    if (!formData.customerId) {
      setError('Choisis un client.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/credits', {
        customerId: formData.customerId,
        amount: Number(formData.amount || 0),
        entryType: formData.entryType,
        paymentMethod: formData.paymentMethod,
        note: formData.note,
      });
      await fetchData();
      closeModal();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || 'Impossible d’ajouter ce mouvement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <Wallet className="h-8 w-8 text-orange-500" />
            Gestion des crédits
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Suit les encours clients et ajoute les mouvements de crédit ou de règlement.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600"
        >
          <Plus className="h-5 w-5" />
          Nouveau mouvement
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Encours total" value={formatCurrency(summary.totalBalance)} icon={<Wallet className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Clients suivis" value={String(summary.totalCustomers)} icon={<CreditCard className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Mouvements" value={String(summary.totalEntries)} icon={<Plus className="h-5 w-5 text-orange-500" />} />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Rechercher un client ou un mouvement"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Soldes clients</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Téléphone</th>
                  <th className="px-6 py-4">Plafond</th>
                  <th className="px-6 py-4">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      Chargement...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      Aucun client pour le moment.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{customer.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{customer.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(customer.creditLimit)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-orange-600 dark:text-orange-400">
                        {formatCurrency(balances.get(customer._id) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Historique des mouvements</h2>
          </div>
          <div className="max-h-[44rem] overflow-auto">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Chargement...</div>
            ) : creditRows.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Aucun mouvement de crédit.</div>
            ) : (
              <div className="space-y-4 p-4">
                {creditRows.map((entry) => {
                  const customer = customerMap.get(entry.customerId);
                  return (
                    <div
                      key={entry._id}
                      className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{customer?.name || 'Client supprimé'}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatDate(entry.createdAt)}</p>
                        </div>
                        <span
                          className={`text-sm font-bold ${
                            entry.entryType === 'payment'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}
                        >
                          {entry.entryType === 'payment' ? '-' : '+'}
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {entry.entryType === 'payment' ? 'règlement' : 'crédit'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {entry.paymentMethod}
                        </span>
                      </div>
                      {entry.note ? (
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{entry.note}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nouveau mouvement de crédit</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Ajoute un crédit ou un règlement lié à un client.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Client</label>
                <select
                  value={formData.customerId}
                  onChange={(event) => setFormData((current) => ({ ...current, customerId: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Choisir un client</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Type</label>
                  <select
                    value={formData.entryType}
                    onChange={(event) => setFormData((current) => ({ ...current, entryType: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="credit">crédit</option>
                    <option value="payment">règlement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Montant</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(event) => setFormData((current) => ({ ...current, amount: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Mode</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(event) => setFormData((current) => ({ ...current, paymentMethod: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="cash">cash</option>
                  <option value="card">card</option>
                  <option value="cmi">cmi</option>
                  <option value="transfer">transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Note</label>
                <textarea
                  value={formData.note}
                  onChange={(event) => setFormData((current) => ({ ...current, note: event.target.value }))}
                  className="mt-2 h-24 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-800">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void createEntry()}
                className="flex-1 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:bg-gray-300"
              >
                {submitting ? 'Enregistrement...' : 'Ajouter le mouvement'}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <div className="rounded-2xl bg-orange-50 p-3 dark:bg-orange-900/20">{icon}</div>
    </div>
  </div>
);

export default CreditsManagement;

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Mail, MapPin, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';

interface Customer {
  _id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  creditLimit: number;
  openingBalance: number;
  createdAt: string;
}

interface CreditEntry {
  _id: string;
  customerId: string;
  amount: number;
  entryType: 'credit' | 'payment';
  createdAt: string;
}

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  creditLimit: '0',
  openingBalance: '0',
};

const ClientsManagement = () => {
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
      setError(err?.response?.data?.message || 'Impossible de charger les clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const balancesByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((customer) => {
      map.set(customer._id, Number(customer.openingBalance || 0));
    });
    credits.forEach((entry) => {
      const current = map.get(entry.customerId) || 0;
      const signedAmount = entry.entryType === 'payment' ? -Number(entry.amount || 0) : Number(entry.amount || 0);
      map.set(entry.customerId, current + signedAmount);
    });
    return map;
  }, [customers, credits]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.address].some((value) =>
        String(value || '').toLowerCase().includes(term)
      )
    );
  }, [customers, searchTerm]);

  const totals = useMemo(
    () => ({
      count: customers.length,
      totalBalance: Array.from(balancesByCustomer.values()).reduce((sum, value) => sum + Number(value || 0), 0),
      totalLimit: customers.reduce((sum, customer) => sum + Number(customer.creditLimit || 0), 0),
    }),
    [balancesByCustomer, customers]
  );

  const openModal = () => {
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData(emptyForm);
  };

  const createCustomer = async () => {
    if (!formData.name.trim()) {
      setError('Le nom du client est obligatoire.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/customers', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        notes: formData.notes,
        creditLimit: Number(formData.creditLimit || 0),
        openingBalance: Number(formData.openingBalance || 0),
      });
      await fetchData();
      closeModal();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || 'Impossible de créer le client.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    if (!window.confirm('Supprimer ce client et ses crédits associés ?')) return;
    try {
      await api.delete(`/customers/${customerId}`);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || 'Impossible de supprimer le client.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <Users className="h-8 w-8 text-orange-500" />
            Gestion des clients
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Crée, consulte et supprime les clients avec leur encours de crédit.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600"
        >
          <Plus className="h-5 w-5" />
          Nouveau client
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Clients" value={String(totals.count)} icon={<Users className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Encours total" value={formatCurrency(totals.totalBalance)} icon={<Building2 className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Plafonds crédit" value={formatCurrency(totals.totalLimit)} icon={<MapPin className="h-5 w-5 text-orange-500" />} />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Rechercher un client, téléphone ou email"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Adresse</th>
                <th className="px-6 py-4">Solde</th>
                <th className="px-6 py-4">Plafond</th>
                <th className="px-6 py-4">Créé le</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Chargement des clients...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const balance = balancesByCustomer.get(customer._id) || 0;
                  return (
                    <tr key={customer._id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                        {customer.notes ? (
                          <p className="mt-1 text-xs text-gray-400">{customer.notes}</p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="space-y-1">
                          {customer.phone ? (
                            <p className="inline-flex items-center gap-2">
                              <Phone className="h-4 w-4 text-orange-500" />
                              {customer.phone}
                            </p>
                          ) : null}
                          {customer.email ? (
                            <p className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4 text-orange-500" />
                              {customer.email}
                            </p>
                          ) : null}
                          {!customer.phone && !customer.email ? '-' : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{customer.address || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-orange-600 dark:text-orange-400">
                        {formatCurrency(balance)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(customer.creditLimit)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => void deleteCustomer(customer._id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nouveau client</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Crée un client avec ses informations et son encours initial.
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

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <Field label="Nom" value={formData.name} onChange={(value) => setFormData((current) => ({ ...current, name: value }))} />
              <Field label="Téléphone" value={formData.phone} onChange={(value) => setFormData((current) => ({ ...current, phone: value }))} />
              <Field label="Email" value={formData.email} onChange={(value) => setFormData((current) => ({ ...current, email: value }))} />
              <Field label="Adresse" value={formData.address} onChange={(value) => setFormData((current) => ({ ...current, address: value }))} />
              <Field
                label="Plafond crédit"
                type="number"
                value={formData.creditLimit}
                onChange={(value) => setFormData((current) => ({ ...current, creditLimit: value }))}
              />
              <Field
                label="Solde initial"
                type="number"
                value={formData.openingBalance}
                onChange={(value) => setFormData((current) => ({ ...current, openingBalance: value }))}
              />
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
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
                onClick={() => void createCustomer()}
                className="flex-1 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:bg-gray-300"
              >
                {submitting ? 'Création...' : 'Créer le client'}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
    />
  </div>
);

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

export default ClientsManagement;
